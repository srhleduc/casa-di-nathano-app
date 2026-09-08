// Tests des créneaux /reserver. Lancer : node lib/reservation/slots.test.mjs
import { estimateDurationMin, buildRequestedAtISO, buildCandidateSlots, reservationsForSolver } from "./slots.js";

let passed = 0;
let failed = 0;
function ok(cond, name) {
  if (cond) passed++;
  else {
    failed++;
    console.error("  ✗ " + name);
  }
}

ok(estimateDurationMin(2) === 75 && estimateDurationMin(4) === 90 && estimateDurationMin(6) === 105, "durées 2/4/6");
ok(estimateDurationMin(8) === 125, "8 pers → 105 + 2×10");

ok(buildRequestedAtISO("2026-09-10", 19 * 60 + 30) === "2026-09-10T19:30:00", "ISO heure murale");

// --- buildCandidateSlots ---
{
  const services = [{ serviceNumber: 1, label: "1er", startMin: 19 * 60, endMin: 20 * 60 + 30 }];
  const slots = buildCandidateSlots(services, { slotGranularityMinutes: 30 }, 4); // durée 90
  // 19:00 (fin 20:30 ok). 19:30 → 21:00 > 20:30 ko. Donc 1 seul créneau.
  ok(slots.length === 1 && slots[0].startMin === 19 * 60, "un créneau ne peut pas déborder du service");
}
{
  const services = [{ serviceNumber: 1, label: "1er", startMin: 19 * 60, endMin: 22 * 60 }];
  const slots = buildCandidateSlots(services, { slotGranularityMinutes: 15 }, 2); // durée 75
  // de 19:00 à 20:45 par pas de 15 → 19:00,19:15,...,20:45 = 8 créneaux
  ok(slots.length === 8 && slots[7].startMin === 20 * 60 + 45, "pas de 15 min, dernier créneau à 20:45");
}
{
  const services = [{ serviceNumber: 1, label: "1er", startMin: 19 * 60, endMin: 22 * 60 }];
  const slots = buildCandidateSlots(services, { slotGranularityMinutes: 30 }, 2, { nowMin: 19 * 60 + 40, leadMin: 30 });
  // écarte tout créneau < 20:10 → 19:00, 19:30 exclus ; 20:00 exclus (<20:10) ; premier = 20:30
  ok(slots[0].startMin === 20 * 60 + 30, "date du jour : créneaux trop proches écartés");
}

// --- reservationsForSolver ---
{
  const rows = [
    { id: "a", status: "confirmed", requestedAt: "2026-09-10T19:00:00+00:00", partySize: 4, estimatedDurationMinutes: 90 },
    { id: "b", status: "cancelled", requestedAt: "2026-09-10T20:00:00+00:00", partySize: 2, estimatedDurationMinutes: 75 },
    { id: "c", status: "seated", requestedAt: "2026-09-11T19:00:00+00:00", partySize: 6, estimatedDurationMinutes: 105 },
  ];
  const out = reservationsForSolver(rows, "2026-09-10");
  ok(out.length === 1 && out[0].id === "a" && out[0].startMin === 19 * 60, "filtre date + statut, HH:MM littéral");
}

console.log(`\nslots: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
