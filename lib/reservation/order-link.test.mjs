// Tests rapprochement commande ↔ réservation. node lib/reservation/order-link.test.mjs
import { assignmentsByReservation, matchReservationForOrder } from "./order-link.js";

let passed = 0;
let failed = 0;
function ok(cond, name) {
  if (cond) passed++;
  else {
    failed++;
    console.error("  ✗ " + name);
  }
}

// --- assignmentsByReservation ---
{
  const rows = [
    { reservationId: "a", tableId: "t1" },
    { reservationId: "a", tableId: "t2" },
    { reservation_id: "b", table_id: "t3" },
  ];
  const m = assignmentsByReservation(rows);
  ok(m.a.length === 2 && m.b[0] === "t3", "deux formats de clés supportés");
}

// --- matchReservationForOrder ---
const R = (id, at, status = "confirmed") => ({ id, requestedAt: at, status });
{
  const reservations = [R("nadine", "2026-09-20T19:00:00"), R("autre", "2026-09-20T13:00:00")];
  const asg = { nadine: ["t1"], autre: ["t5"] };
  ok(
    matchReservationForOrder({ tableIds: ["t1", "t2"] }, reservations, asg, "2026-09-20T19:05:00") === "nadine",
    "table t1 → réservation de Nadine"
  );
  ok(
    matchReservationForOrder({ tableIds: ["t9"] }, reservations, asg, "2026-09-20T19:05:00") === null,
    "aucune table commune → null"
  );
}
{
  // deux services sur T1 → celui le plus proche de maintenant
  const reservations = [R("tot", "2026-09-20T19:00:00"), R("tard", "2026-09-20T21:00:00")];
  const asg = { tot: ["t1"], tard: ["t1"] };
  ok(matchReservationForOrder({ tableIds: ["t1"] }, reservations, asg, "2026-09-20T19:10:00") === "tot", "19:10 → résa de 19h");
  ok(matchReservationForOrder({ tableIds: ["t1"] }, reservations, asg, "2026-09-20T20:40:00") === "tard", "20:40 → résa de 21h");
}
{
  const reservations = [R("seated", "2026-09-20T19:00:00", "seated"), R("cancel", "2026-09-20T19:00:00", "cancelled")];
  const asg = { seated: ["t1"], cancel: ["t1"] };
  ok(matchReservationForOrder({ tableIds: ["t1"] }, reservations, asg, "2026-09-20T19:05:00") === null, "que des non-confirmed → null");
}
{
  const reservations = [R("hier", "2026-09-19T19:00:00")];
  ok(matchReservationForOrder({ tableIds: ["t1"] }, reservations, { hier: ["t1"] }, "2026-09-20T19:05:00") === null, "autre date → null");
}
{
  ok(matchReservationForOrder({ tableIds: [] }, [R("x", "2026-09-20T19:00:00")], { x: ["t1"] }, "2026-09-20T19:00:00") === null, "aucune table → null");
}

console.log(`\norder-link: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
