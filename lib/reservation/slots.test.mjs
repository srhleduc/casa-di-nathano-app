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
  // Plage d'ARRIVÉE (brief §7) : l'occupation peut déborder la fin du service.
  const services = [{ serviceNumber: 1, label: "1er", startMin: 19 * 60, endMin: 20 * 60 + 30 }];
  const slots = buildCandidateSlots(services, { slotGranularityMinutes: 30 }, 4); // durée 90
  // arrivées 19:00, 19:30, 20:00 (< 20:30) ; 20:00 + 90 = 21:30, autorisé.
  ok(slots.length === 3 && slots[2].startMin === 20 * 60, "l'occupation peut se terminer après la fin du service");
}
{
  const services = [{ serviceNumber: 3, label: "Après-midi", startMin: 14 * 60 + 30, endMin: 18 * 60 }];
  const slots = buildCandidateSlots(services, { slotGranularityMinutes: 15 }, 2); // durée 75
  // arrivées de 14:30 à 17:45 par pas de 15 → dernière arrivée 17:45 (pas 16:45).
  ok(slots[slots.length - 1].startMin === 17 * 60 + 45, "dernière arrivée = fin du service − 1 pas, pas fin − durée");
}
{
  const services = [{ serviceNumber: 1, label: "1er", startMin: 19 * 60, endMin: 22 * 60 }];
  const slots = buildCandidateSlots(services, { slotGranularityMinutes: 15 }, 2); // durée 75
  // arrivées de 19:00 à 21:45 par pas de 15 → 12 créneaux, dernier 21:45
  ok(slots.length === 12 && slots[11].startMin === 21 * 60 + 45, "pas de 15 min, dernière arrivée à 21:45");
}
{
  const services = [{ serviceNumber: 1, label: "1er", startMin: 19 * 60, endMin: 22 * 60 }];
  const slots = buildCandidateSlots(services, { slotGranularityMinutes: 30 }, 2, { nowMin: 19 * 60 + 40, leadMin: 30 });
  // écarte tout créneau < 20:10 → 19:00, 19:30 exclus ; 20:00 exclus (<20:10) ; premier = 20:30
  ok(slots[0].startMin === 20 * 60 + 30, "date du jour : créneaux trop proches écartés");
}
{
  // délai minimum piloté par settings.bookingLeadMinutes (défaut 30)
  const services = [{ serviceNumber: 3, label: "Après-midi", startMin: 14 * 60 + 30, endMin: 18 * 60 }];
  const now = 15 * 60 + 39; // 15:39
  const s30 = buildCandidateSlots(services, { slotGranularityMinutes: 15, bookingLeadMinutes: 30 }, 2, { nowMin: now });
  ok(s30[0].startMin === 16 * 60 + 15, "lead 30 → premier créneau 16:15");
  const s15 = buildCandidateSlots(services, { slotGranularityMinutes: 15, bookingLeadMinutes: 15 }, 2, { nowMin: now });
  ok(s15[0].startMin === 16 * 60, "lead 15 → premier créneau 16:00");
  const sDefault = buildCandidateSlots(services, { slotGranularityMinutes: 15 }, 2, { nowMin: now });
  ok(sDefault[0].startMin === 16 * 60 + 15, "bookingLeadMinutes absent → défaut 30");
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
{
  const rows = [{ id: "a", status: "confirmed", requestedAt: "2026-09-10T19:00:00", partySize: 4, estimatedDurationMinutes: 90, preferredLayoutId: "terrasse" }];
  ok(reservationsForSolver(rows, "2026-09-10")[0].preferredLayoutId === "terrasse", "reservationsForSolver propage preferredLayoutId");
}

console.log(`\nslots: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
