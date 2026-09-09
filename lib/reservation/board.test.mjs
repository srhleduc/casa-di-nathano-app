// Tests du board réservation. Lancer : node lib/reservation/board.test.mjs
import { computeTableStatuses, serviceSynthesis } from "./board.js";

let passed = 0;
let failed = 0;
function ok(cond, name) {
  if (cond) passed++;
  else {
    failed++;
    console.error("  ✗ " + name);
  }
}

const T = (id, active = true) => ({ id, active, gridRow: 0, gridCol: 0 });
// durée 90 + marge 15 = 105
const R = (id, start, status, party = 4) => ({ id, startMin: start, durationMin: 90, status, partySize: party });

{
  const tables = [T("t1"), T("t2"), T("t3"), T("t4"), T("dead", false)];
  const reservations = [
    R("res_libre_none", 0, "confirmed"), // pas d'affectation
    R("a", 1260, "confirmed"), // à venir (now 1200) → t1 réservée
    R("b", 1140, "seated"), // en cours (now 1200) → t2 occupée
    R("c", 1110, "seated"), // finit 1110+105=1215, now 1200 → dans 15 min → t3 bientôt
    R("d", 1110, "seated"), // combo t4+? → groupée
  ];
  const assignments = [
    { reservationId: "a", tableIds: ["t1"] },
    { reservationId: "b", tableIds: ["t2"] },
    { reservationId: "c", tableIds: ["t3"] },
    { reservationId: "d", tableIds: ["t4", "tX"] },
  ];
  const s = computeTableStatuses(tables, assignments, reservations, 1200, { soonMin: 20, marginMin: 15 });
  ok(s.t1.status === "reservee", "table avec résa à venir → réservée");
  ok(s.t2.status === "occupee", "table avec résa en cours → occupée");
  ok(s.t3.status === "bientot", "table qui se libère dans 15 min → bientôt");
  ok(s.t4.status === "groupee", "table en combinaison en cours → groupée");
  ok(s.dead.status === "bloquee", "table inactive → bloquée");

  // t5 sans affectation
  const s2 = computeTableStatuses([T("t5")], [], reservations, 1200);
  ok(s2.t5.status === "libre", "table sans affectation → libre");
}

{
  // une résa "seated" déjà finie (now après end) ne rend pas la table occupée
  const s = computeTableStatuses([T("t1")], [{ reservationId: "x", tableIds: ["t1"] }], [R("x", 900, "seated")], 1200);
  ok(s.t1.status === "libre", "résa terminée → table redevient libre");
}

// --- états "à renouveler" / "terminée" (option `services` requise) ---
{
  const tables = [T("t1")];
  const assignments = [{ reservationId: "done", tableIds: ["t1"] }];
  const reservations = [R("done", 780, "completed")]; // 13:00, encaissée
  const services = [
    { startMin: 720, endMin: 870 }, // midi 12:00-14:30
    { startMin: 1140, endMin: 1350 }, // soir 19:00-22:30
  ];
  ok(
    computeTableStatuses(tables, assignments, reservations, 900, { services }).t1.status === "a_renouveler",
    "encaissée + service encore à venir → à renouveler"
  );
  ok(
    computeTableStatuses(tables, assignments, reservations, 1380, { services }).t1.status === "terminee",
    "encaissée + plus aucun service → terminée"
  );
  ok(
    computeTableStatuses(tables, assignments, reservations, 900).t1.status === "libre",
    "sans l'option services → comportement inchangé (libre)"
  );
  const s4 = computeTableStatuses(
    tables,
    [{ reservationId: "done", tableIds: ["t1"] }, { reservationId: "next", tableIds: ["t1"] }],
    [R("done", 780, "completed"), R("next", 1200, "confirmed")],
    900,
    { services }
  );
  ok(s4.t1.status === "reservee", "réservation à venir prime sur « à renouveler »");
}

// --- serviceSynthesis ---
{
  const service = { maxCovers: 40 };
  const res = [R("a", 1140, "confirmed", 4), R("b", 1200, "seated", 6), R("c", 1230, "cancelled", 8)];
  const syn = serviceSynthesis(res, service, 1);
  ok(syn.reserved === 10, "couverts réservés = 4 + 6 (annulée exclue)");
  ok(syn.capacity === 40 && syn.remaining === 30, "capacité restante = 40 - 10");
  ok(syn.full === false && syn.count === 2 && syn.unassignedCount === 1, "pas complet, 2 résas, 1 non placée");

  const syn2 = serviceSynthesis([R("a", 1140, "confirmed", 40), R("b", 1200, "confirmed", 5)], service);
  ok(syn2.full === true && syn2.remaining === 0, "capacité atteinte → complet");

  const syn3 = serviceSynthesis(res, { maxCovers: null });
  ok(syn3.capacity === null && syn3.remaining === null, "pas de capacité définie → null");
}

console.log(`\nboard: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
