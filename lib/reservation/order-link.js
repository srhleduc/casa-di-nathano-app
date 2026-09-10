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

// Id d'une réservation DÉJÀ installée (seated) du jour posée sur l'une de
// `tableIds` — pour rattacher une commande sur place à une occupation créée à
// la main (« Marquer occupée » / « Combiner » sur le board) sans en recréer
// une « Passage » en double. null si aucune.
export function seatedReservationForTables({ tableIds } = {}, reservations, assignmentsByRes = {}, nowWall = "") {
  const want = new Set(tableIds || []);
  if (!want.size) return null;
  const day = String(nowWall).slice(0, 10);
  const hit = (reservations || []).find((r) => {
    if (r.status !== "seated") return false;
    if (String(r.requestedAt || "").slice(0, 10) !== day) return false;
    return (assignmentsByRes[r.id] || []).some((t) => want.has(t));
  });
  return hit ? hit.id : null;
}

// Tables actuellement solidaires de `tableId` : elle-même + toutes celles
// affectées à la même réservation active du jour (combinaison « Passage »
// posée par l'équipe, ou réservation multi-tables). Sert à faire tomber les
// commandes /sat de T8 et de T9 sur une seule commande quand T8+T9 forment un
// groupe. Renvoie la liste triée (clé stable pour l'index d'unicité).
export function tablesLinkedTo(tableId, reservations, assignmentsByRes = {}, dayStr = "") {
  const out = new Set([tableId]);
  for (const r of reservations || []) {
    if (["cancelled", "no_show", "completed"].includes(r.status)) continue;
    if (dayStr && String(r.requestedAt || "").slice(0, 10) !== dayStr) continue;
    const tids = assignmentsByRes[r.id] || [];
    if (tids.includes(tableId)) for (const t of tids) out.add(t);
  }
  return [...out].sort();
}
