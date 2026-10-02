// Affectations FORCÉES (pinned) : tables réellement occupées / figées par
// l'équipe pour une réservation (forçage manuel, « Passage », service commencé).
// Pur, sans I/O.
//
// Le moteur sait les respecter (optimizer.solve, entrée `pinned`), mais encore
// faut-il les lui transmettre : par le board ET par la page de réservation en
// ligne (sinon un client pouvait réserver une table déjà occupée — le moteur
// croyait pouvoir « déplacer » une table de passage déjà installée).

const MAX_PINNED = 300;
const MAX_TABLES_PER_PIN = 20;

// Valide / nettoie l'entrée `pinned` reçue par la route /api/reservations/solve :
// { [reservationId]: { tableIds: string[], capacity?: number, comboId?: string } }.
// Renvoie un objet propre (jamais d'exception : une entrée invalide est ignorée).
export function sanitizePinned(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  let n = 0;
  for (const [rid, p] of Object.entries(raw)) {
    if (n >= MAX_PINNED) break;
    if (!p || typeof p !== "object" || !Array.isArray(p.tableIds)) continue;
    const tableIds = [...new Set(p.tableIds.filter((t) => typeof t === "string" && t))].slice(0, MAX_TABLES_PER_PIN);
    if (!tableIds.length) continue;
    const entry = { tableIds };
    const cap = Number(p.capacity);
    if (Number.isFinite(cap) && cap > 0) entry.capacity = cap;
    if (typeof p.comboId === "string" && p.comboId) entry.comboId = p.comboId;
    out[String(rid)] = entry;
    n++;
  }
  return out;
}

// Construit `pinned` à partir des lignes reservation_table_assignments
// (`{ reservationId, tableId, manual }`) : uniquement les affectations
// manuelles, et seulement pour les réservations passées au moteur
// (`reservationIds`). `capacityOf(tableId)` : places d'une table.
export function pinnedFromAssignments(assignments, reservationIds, capacityOf = () => 2) {
  const wanted = new Set([...(reservationIds || [])].map(String));
  const byRes = {};
  for (const a of assignments || []) {
    if (!a || !a.manual) continue;
    const rid = String(a.reservationId);
    if (!wanted.has(rid)) continue;
    (byRes[rid] = byRes[rid] || []).push(a.tableId);
  }
  const pinned = {};
  for (const [rid, ids] of Object.entries(byRes)) {
    const tableIds = [...new Set(ids)];
    pinned[rid] = { tableIds, capacity: tableIds.reduce((s, tid) => s + (Number(capacityOf(tid)) || 2), 0) };
  }
  return pinned;
}
