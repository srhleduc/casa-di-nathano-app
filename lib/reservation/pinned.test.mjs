// Tests des affectations forcées. Lancer : node lib/reservation/pinned.test.mjs
import { sanitizePinned, pinnedFromAssignments } from "./pinned.js";
import { solve, feasibleSlots } from "./optimizer.js";

let passed = 0;
let failed = 0;
function ok(cond, name) {
  if (cond) passed++;
  else {
    failed++;
    console.error("  ✗ " + name);
  }
}

// --- sanitizePinned ---
{
  ok(Object.keys(sanitizePinned(null)).length === 0, "null → {}");
  ok(Object.keys(sanitizePinned([1, 2])).length === 0, "tableau → {}");
  const s = sanitizePinned({
    r1: { tableIds: ["a", "b", "a", 3, ""], capacity: 4, comboId: "k" },
    r2: { tableIds: [] },
    r3: "nope",
    r4: { tableIds: ["x"], capacity: -2 },
  });
  ok(JSON.stringify(s.r1) === JSON.stringify({ tableIds: ["a", "b"], capacity: 4, comboId: "k" }), "r1 nettoyée (doublons / non-strings)");
  ok(!("r2" in s) && !("r3" in s), "entrées invalides ignorées");
  ok(s.r4.tableIds[0] === "x" && !("capacity" in s.r4), "capacité négative ignorée");
}

// --- pinnedFromAssignments ---
{
  const asg = [
    { reservationId: "w", tableId: "t1", manual: true },
    { reservationId: "w", tableId: "t2", manual: true },
    { reservationId: "auto", tableId: "t3", manual: false },
    { reservationId: "autre-jour", tableId: "t4", manual: true },
  ];
  const p = pinnedFromAssignments(asg, ["w", "auto"], (tid) => (tid === "t1" ? 2 : 3));
  ok(Object.keys(p).join() === "w", "seules les affectations manuelles des réservations du jour");
  ok(p.w.tableIds.length === 2 && p.w.capacity === 5, "tables + capacité sommée");
}

// --- le moteur respecte une table de passage déjà occupée ---
{
  const tables = [
    { id: "A", active: true, capacityPreferred: 2, capacityMax: 2, priorityOrder: 1 },
    { id: "B", active: true, capacityPreferred: 2, capacityMax: 2, priorityOrder: 2 },
  ];
  const walk = { id: "walk", partySize: 2, startMin: 780, durationMin: 90 };
  const cand = { id: "cand", partySize: 2, startMin: 795, durationMin: 90 };
  const pinned = { walk: { tableIds: ["B"], capacity: 2 } };

  const sans = solve({ tables, combinations: [], reservations: [walk, cand] });
  ok(sans.assignments.find((a) => a.reservationId === "walk").tableIds[0] === "A", "sans pin : le moteur re-place le passage sur A (priorité)");

  const avec = solve({ tables, combinations: [], reservations: [walk, cand], pinned });
  ok(avec.assignments.find((a) => a.reservationId === "walk").tableIds[0] === "B", "avec pin : le passage reste sur B");
  ok(avec.assignments.find((a) => a.reservationId === "cand").tableIds[0] === "A", "avec pin : le client en ligne va sur A, pas sur B");
}

// --- cas du signalement : passage T1+T2 combiné → T1 n'est plus réservable en ligne ---
{
  const tables = [
    { id: "T1", active: true, capacityPreferred: 2, capacityMax: 2, priorityOrder: 1 },
    { id: "T2", active: true, capacityPreferred: 2, capacityMax: 2, priorityOrder: 2 },
    { id: "T3", active: true, capacityPreferred: 2, capacityMax: 2, priorityOrder: 3 },
  ];
  const combinations = [{ id: "k12", tableIds: ["T1", "T2"], capacity: 4, isUsual: true, penaltyScore: 0 }];
  const walk = { id: "walk", partySize: 4, startMin: 780, durationMin: 90 };
  const slots = [{ startMin: 795, partySize: 2, durationMin: 90 }, { startMin: 795, partySize: 4, durationMin: 90 }];
  const pinned = { walk: { tableIds: ["T1", "T2"], capacity: 4 } };

  const f = feasibleSlots({ tables, combinations, reservations: [walk], pinned }, slots);
  ok(f.some((s) => s.partySize === 2), "2 couverts : T3 reste réservable");
  ok(!f.some((s) => s.partySize === 4), "4 couverts : T1+T2 occupées → pas de créneau");
}

console.log(`\npinned: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
