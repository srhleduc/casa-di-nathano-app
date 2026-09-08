// Statuts d'affichage du board réservation + synthèse de service. Pur.

const DONE_STATUSES = ["cancelled", "completed", "no_show"];

// Statut de chaque table placée, d'après les affectations du jour (solveur ou
// forcées) et l'heure courante `nowMin`.
//   bloquee  : table inactive / non placée
//   occupee  : une réservation "seated" couvre l'heure courante
//   bientot  : idem mais se libère dans <= soonMin minutes
//   groupee  : occupée via une combinaison (plusieurs tables)
//   reservee : une réservation à venir aujourd'hui
//   libre    : rien
export function computeTableStatuses(placedTables, assignments, reservations, nowMin, { soonMin = 20, marginMin = 15 } = {}) {
  const resById = Object.fromEntries((reservations || []).map((r) => [String(r.id), r]));
  const byTable = {};
  for (const a of assignments || []) {
    for (const tid of a.tableIds || []) (byTable[tid] = byTable[tid] || []).push(a);
  }
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
    for (const a of byTable[t.id] || []) {
      const r = resById[String(a.reservationId)];
      if (!r || DONE_STATUSES.includes(r.status)) continue;
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
    else status = "libre";
    out[t.id] = { status, current, next };
  }
  return out;
}

// Synthèse d'un service : couverts réservés, capacité, capacité restante.
export function serviceSynthesis(reservationsForService, service, unassignedCount = 0) {
  const active = (reservationsForService || []).filter((r) => !["cancelled", "no_show"].includes(r.status));
  const reserved = active.reduce((s, r) => s + (r.partySize || 0), 0);
  const capacity = service && service.maxCovers != null ? service.maxCovers : null;
  const remaining = capacity != null ? Math.max(0, capacity - reserved) : null;
  return {
    count: active.length,
    reserved,
    capacity,
    remaining,
    unassignedCount,
    full: capacity != null && reserved >= capacity,
  };
}
