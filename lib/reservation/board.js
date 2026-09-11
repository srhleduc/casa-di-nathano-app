// Statuts d'affichage du board réservation + synthèse de service. Pur.

// Statut de chaque table placée, d'après les affectations du jour (solveur ou
// forcées) et l'heure courante `nowMin`.
//   bloquee      : table inactive / non placée
//   occupee      : une réservation "seated" couvre l'heure courante
//   bientot      : idem mais se libère dans <= soonMin minutes
//   groupee      : occupée via une combinaison (plusieurs tables)
//   reservee     : une réservation à venir aujourd'hui
//   a_renouveler : ses clients ont été encaissés (réservation "completed") et
//                  aucune réservation ne la tient, mais un service est encore à
//                  venir ce jour → à débarrasser / réinitialiser. (nécessite
//                  l'option `services`, sinon on retombe sur "libre".)
//   terminee     : encaissée et plus aucun service à suivre ce jour → personne
//                  ne pourra plus la réserver aujourd'hui.
//   libre        : rien
//
// `occupiedTableIds` (option) : tables portant une commande sur place ouverte
// non encaissée — marquées "occupée" même sans réservation posée dessus (ex.
// commande /sat prise sans passer par une réservation « Passage »).
export function computeTableStatuses(
  placedTables,
  assignments,
  reservations,
  nowMin,
  { soonMin = 20, marginMin = 15, services = null, occupiedTableIds = null } = {}
) {
  const orderOccupied = occupiedTableIds instanceof Set ? occupiedTableIds : new Set(occupiedTableIds || []);
  const resById = Object.fromEntries((reservations || []).map((r) => [String(r.id), r]));
  const byTable = {};
  for (const a of assignments || []) {
    for (const tid of a.tableIds || []) (byTable[tid] = byTable[tid] || []).push(a);
  }
  // Un service est-il encore ouvert (fenêtre d'arrivée non close) aujourd'hui ?
  const hasServiceAhead = Array.isArray(services) && services.some((s) => s.endMin > nowMin);
  const terminalStatesEnabled = Array.isArray(services) && services.length > 0;
  const out = {};
  for (const t of placedTables || []) {
    if (t.active === false) {
      out[t.id] = { status: "bloquee", current: null, next: null };
      continue;
    }
    let current = null;
    let currentEnd = 0;
    let grouped = false;
    let next = null;
    let anyCompleted = false;
    for (const a of byTable[t.id] || []) {
      const r = resById[String(a.reservationId)];
      if (!r) continue;
      if (r.status === "cancelled" || r.status === "no_show") continue;
      if (r.status === "completed") {
        anyCompleted = true;
        continue;
      }
      const end = r.startMin + r.durationMin + marginMin;
      if (r.status === "seated" && nowMin >= r.startMin && nowMin < end) {
        current = r.id;
        currentEnd = end;
        if ((a.tableIds || []).length > 1) grouped = true;
      } else if (r.startMin >= nowMin) {
        if (next == null || r.startMin < resById[String(next)].startMin) next = r.id;
      }
    }
    let status;
    if (current != null) status = grouped ? "groupee" : currentEnd - nowMin <= soonMin ? "bientot" : "occupee";
    else if (next != null) status = "reservee";
    else if (anyCompleted && terminalStatesEnabled) status = hasServiceAhead ? "a_renouveler" : "terminee";
    else status = "libre";
    // Commande sur place ouverte sur la table sans réservation qui la tienne
    // → occupée quand même (elle ne doit pas rester "disponible" en vert).
    if (current == null && orderOccupied.has(t.id)) status = "occupee";
    out[t.id] = { status, current, next };
  }
  return out;
}

// Synthèse d'un service : couverts réservés, capacité, capacité restante.
// `reservationsForService` : [{ partySize, status, layoutId? }]. Si le service
// a un découpage `maxCoversByLayout` (couverts max par zone/plan de salle), on
// renvoie aussi `zones: [{ layoutId, reserved, capacity, remaining, full }]`
// (les réservations sans `layoutId` sont hors zones). Le total reste calculé
// sur `service.maxCovers` (= somme des zones), inchangé.
export function serviceSynthesis(reservationsForService, service, unassignedCount = 0) {
  const active = (reservationsForService || []).filter((r) => !["cancelled", "no_show"].includes(r.status));
  const reserved = active.reduce((s, r) => s + (r.partySize || 0), 0);
  const capacity = service && service.maxCovers != null ? service.maxCovers : null;
  const remaining = capacity != null ? Math.max(0, capacity - reserved) : null;

  const byLayout = (service && service.maxCoversByLayout) || {};
  let zones = null;
  if (Object.keys(byLayout).length > 0) {
    const reservedByLayout = {};
    for (const r of active) {
      if (r.layoutId == null) continue;
      reservedByLayout[r.layoutId] = (reservedByLayout[r.layoutId] || 0) + (r.partySize || 0);
    }
    zones = Object.entries(byLayout).map(([layoutId, cap]) => {
      const c = Number(cap) > 0 ? Number(cap) : 0;
      const res = reservedByLayout[layoutId] || 0;
      return { layoutId, reserved: res, capacity: c, remaining: Math.max(0, c - res), full: c > 0 && res >= c };
    });
  }

  return {
    count: active.length,
    reserved,
    capacity,
    remaining,
    unassignedCount,
    full: capacity != null && reserved >= capacity,
    zones,
  };
}

// Réservations à verrouiller (comme un forçage manuel de l'équipe) parce que
// LEUR service a commencé : avant le début du service, l'affectation reste
// libre — le moteur peut la réoptimiser à chaque changement (nouvelle résa,
// annulation…) et l'équipe peut l'échanger à la main. Dès que le service
// commence, la place doit être définie jusqu'à l'arrivée des clients : on la
// fige telle qu'elle est à cet instant, elle ne bouge plus tant que la
// réservation n'est pas déjà verrouillée autrement (forçage manuel).
// `reservations` : [{ id, startMin, status }]. `services` : [{ startMin, endMin }].
// `asgByRes` : { [id]: { tableIds } } (plan du moteur). `manualByRes` :
// { [id]: tableIds } (déjà forcé/verrouillé — à ignorer, rien à refaire).
// Renvoie [{ reservationId, tableIds }] à écrire en forçage manuel.
export function reservationsToAutoLock(reservations, services, asgByRes, manualByRes, nowMin) {
  const out = [];
  for (const r of reservations || []) {
    if (r.status === "cancelled" || r.status === "completed") continue;
    if (manualByRes && manualByRes[r.id]) continue;
    const tableIds = asgByRes?.[r.id]?.tableIds;
    if (!tableIds || !tableIds.length) continue;
    const svc = (services || []).find((s) => r.startMin >= s.startMin && r.startMin < s.endMin);
    if (!svc || nowMin < svc.startMin) continue;
    out.push({ reservationId: r.id, tableIds });
  }
  return out;
}
