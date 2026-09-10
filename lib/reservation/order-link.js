// Rapprochement commande sur place ↔ réservation : quand une commande s'ouvre
// sur une table, retrouver la réservation confirmée du jour posée sur cette
// table. Pur, sans I/O.

// Lignes reservation_table_assignments → { [reservationId]: [tableId, …] }.
export function assignmentsByReservation(rows) {
  const m = {};
  for (const r of rows || []) {
    const rid = r.reservationId ?? r.reservation_id;
    const tid = r.tableId ?? r.table_id;
    if (!rid || !tid) continue;
    (m[rid] = m[rid] || []).push(tid);
  }
  return m;
}

// `nowWall` : "YYYY-MM-DDTHH:MM..." heure murale (même repère que requested_at).
// Renvoie l'id de la réservation `confirmed` du jour de `nowWall` dont les
// tables affectées intersectent `tableIds`, la plus proche de `nowWall` en
// heure demandée (2 services sur la même table → on prend la bonne). null sinon.
export function matchReservationForOrder({ tableIds } = {}, reservations, assignmentsByRes = {}, nowWall = "") {
  const wantTables = new Set(tableIds || []);
  if (wantTables.size === 0) return null;
  const day = String(nowWall).slice(0, 10);
  const nowStr = String(nowWall).slice(0, 16); // "YYYY-MM-DDTHH:MM"

  const candidates = (reservations || []).filter((r) => {
    if (r.status !== "confirmed") return false;
    if (String(r.requestedAt || "").slice(0, 10) !== day) return false;
    const tids = assignmentsByRes[r.id] || [];
    return tids.some((t) => wantTables.has(t));
  });
  if (candidates.length === 0) return null;

  const dist = (r) => Math.abs(minutesOf(String(r.requestedAt || "").slice(11, 16)) - minutesOf(nowStr.slice(11, 16)));
  candidates.sort((a, b) => dist(a) - dist(b) || String(a.requestedAt).localeCompare(String(b.requestedAt)));
  return candidates[0].id;
}

function minutesOf(hhmm) {
  const m = /(\d\d):(\d\d)/.exec(hhmm || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}
