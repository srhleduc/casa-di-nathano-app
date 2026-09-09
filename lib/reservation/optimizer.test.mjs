// Tests du moteur d'optimisation. Lancer : node lib/reservation/optimizer.test.mjs
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

const T = (id, cap) => ({ id, capacityBase: cap, active: true });
const R = (id, party, start, dur = 90) => ({ id, partySize: party, startMin: start, durationMin: dur });
const asgOf = (res, id) => res.assignments.find((a) => a.reservationId === id);

// --- affectation simple, sans gaspillage ---
{
  const r = solve({ tables: [T("t1", 4)], combinations: [], reservations: [R("a", 4, 1140)] });
  ok(r.accepted === 1 && asgOf(r, "a").tableIds[0] === "t1", "party 4 → table 4");
  ok(r.covers === 4, "4 couverts");
}

// --- pas assez de place : petit groupe sur grande table, gros groupe sans combi ---
{
  const r = solve({ tables: [T("t1", 6)], combinations: [], reservations: [R("a", 2, 1140)] });
  ok(r.accepted === 1 && asgOf(r, "a").tableIds[0] === "t1", "party 2 → table 6 (faute de mieux)");

  const r2 = solve({ tables: [T("s1", 2), T("s2", 2)], combinations: [], reservations: [R("a", 6, 1140)] });
  ok(r2.accepted === 0 && r2.unassigned.includes("a"), "party 6, deux 2-tops sans combi → non placé");

  const r3 = solve({
    tables: [T("s1", 2), T("s2", 2)],
    combinations: [{ id: "k1", tableIds: ["s1", "s2"], capacity: 4, isUsual: true, penaltyScore: 0 }],
    reservations: [R("a", 4, 1140)],
  });
  ok(r3.accepted === 1 && asgOf(r3, "a").kind === "combo", "party 4 avec combi cap 4 → placé via combi");
}

// --- chevauchement d'intervalles ---
{
  const base = { tables: [T("t1", 4)], combinations: [] };
  const over = solve({ ...base, reservations: [R("a", 4, 1140, 90), R("b", 4, 1200, 90)] });
  ok(over.accepted === 1, "deux résas sur la même table, horaires qui se chevauchent → une seule");

  const seq = solve({ ...base, reservations: [R("a", 4, 1140, 60), R("b", 4, 1215, 60)] });
  ok(seq.accepted === 2 && asgOf(seq, "a").tableIds[0] === "t1" && asgOf(seq, "b").tableIds[0] === "t1", "horaires disjoints → même table réutilisée");
}

// --- gros groupe placé avant petit (préservation des combinaisons) ---
{
  const r = solve({
    tables: [T("s1", 2), T("s2", 2), T("s3", 2), T("solo", 2)],
    combinations: [
      { id: "k12", tableIds: ["s1", "s2"], capacity: 4, isUsual: true, penaltyScore: 0 },
      { id: "k123", tableIds: ["s1", "s2", "s3"], capacity: 6, isUsual: true, penaltyScore: 0 },
    ],
    reservations: [R("six", 6, 1140), R("deux", 2, 1140)],
  });
  ok(r.accepted === 2, "6 + 2 au même moment → les deux acceptés");
  ok(asgOf(r, "six").kind === "combo" && asgOf(r, "six").capacity === 6, "le 6 prend la combi de 6");
  ok(asgOf(r, "deux").tableIds[0] === "solo", "le 2 prend la table solo, pas une table de la combi");
}

// --- combinaison exceptionnelle pénalisée : on préfère la table seule ---
{
  const r = solve({
    tables: [T("big", 4)],
    combinations: [{ id: "kx", tableIds: ["a", "b"], capacity: 4, isUsual: false, penaltyScore: 50 }],
    reservations: [R("a", 4, 1140)],
  });
  ok(asgOf(r, "a").kind === "table", "table seule préférée à une combi exceptionnelle de capacité égale");
}

// --- feasibleSlots : une réservation existante bloque certains créneaux ---
{
  const input = {
    tables: [T("t1", 4)],
    combinations: [],
    reservations: [R("exist", 4, 1140, 90)], // 19:00 → 20:30
    safetyMarginMinutes: 0,
  };
  const slots = feasibleSlots(input, [
    { partySize: 4, startMin: 1140, durationMin: 90 }, // 19:00 — chevauche l'existante
    { partySize: 4, startMin: 1170, durationMin: 90 }, // 19:30 — chevauche
    { partySize: 4, startMin: 1230, durationMin: 90 }, // 20:30 — libre
  ]);
  ok(slots.length === 1 && slots[0].startMin === 1230, "seul le créneau 20:30 est proposable");
}

// --- safetyMarginMinutes rallonge l'occupation ---
{
  const input = { tables: [T("t1", 4)], combinations: [], safetyMarginMinutes: 30, reservations: [R("a", 4, 1140, 60)] };
  const r = solve({ ...input, reservations: [R("a", 4, 1140, 60), R("b", 4, 1215, 60)] });
  // a occupe 19:00→20:00 +30 marge = jusqu'à 20:30 ; b à 20:15 chevauche
  ok(r.accepted === 1, "marge de sécurité 30 min → b ne rentre pas à 20:15");
}

// --- affectation forcée (pinned) : figée + prise en compte pour les autres ---
{
  const r = solve({
    tables: [T("t1", 4), T("t2", 4)],
    combinations: [],
    reservations: [R("a", 4, 1140), R("b", 4, 1140)],
    pinned: { a: { tableIds: ["t2"], capacity: 4 } },
  });
  ok(asgOf(r, "a").tableIds[0] === "t2" && asgOf(r, "a").manual === true, "réservation forcée sur t2 (manuel)");
  ok(asgOf(r, "b").tableIds[0] === "t1", "l'autre réservation évite t2 (occupée par la forcée)");
}
{
  // forcer sur une table trop petite reste respecté (l'équipe assume)
  const r = solve({ tables: [T("s", 2)], combinations: [], reservations: [R("a", 4, 1140)], pinned: { a: { tableIds: ["s"], capacity: 2 } } });
  ok(r.accepted === 1 && asgOf(r, "a").tableIds[0] === "s", "affectation forcée respectée même sous-dimensionnée");
}

// --- capacityMax : une table peut être poussée au-delà du préféré ---
{
  const r = solve({
    tables: [{ id: "t1", active: true, capacityMin: 1, capacityPreferred: 2, capacityMax: 4 }],
    combinations: [],
    reservations: [R("a", 4, 1140)],
  });
  ok(r.accepted === 1 && asgOf(r, "a").tableIds[0] === "t1", "party 4 → table préf.2/max.4 acceptée");
}

// --- capacityPreferred : gaspillage mesuré sur le préféré, pas sur le max ---
{
  const r = solve({
    tables: [
      { id: "juste", active: true, capacityPreferred: 2, capacityMax: 4 },
      { id: "grande", active: true, capacityPreferred: 4, capacityMax: 4 },
    ],
    combinations: [],
    reservations: [R("a", 2, 1140)],
  });
  ok(asgOf(r, "a").tableIds[0] === "juste", "party 2 → table dont le préféré vaut 2 (moins de gaspillage)");
}

// --- table bloquée : jamais proposée au moteur, mais forçable manuellement ---
{
  const r = solve({
    tables: [
      { id: "ok", active: true, capacityPreferred: 4, capacityMax: 4 },
      { id: "bloq", active: true, blocked: true, capacityPreferred: 4, capacityMax: 4 },
    ],
    combinations: [],
    reservations: [R("a", 4, 1140), R("b", 4, 1140)],
  });
  ok(asgOf(r, "a").tableIds[0] === "ok" && r.unassigned.includes("b"), "table bloquée non utilisée → 2e résa non placée");

  const r2 = solve({
    tables: [{ id: "bloq", active: true, blocked: true, capacityPreferred: 4, capacityMax: 4 }],
    combinations: [],
    reservations: [R("a", 4, 1140)],
    pinned: { a: { tableIds: ["bloq"], capacity: 4 } },
  });
  ok(asgOf(r2, "a").tableIds[0] === "bloq" && asgOf(r2, "a").manual === true, "table bloquée : affectation manuelle respectée");
}

// --- priorityOrder : à choix équivalent, remplit la table prioritaire ---
{
  const r = solve({
    tables: [
      { id: "second", active: true, capacityPreferred: 2, capacityMax: 2, priorityOrder: 2 },
      { id: "premier", active: true, capacityPreferred: 2, capacityMax: 2, priorityOrder: 1 },
    ],
    combinations: [],
    reservations: [R("a", 2, 1140)],
  });
  ok(asgOf(r, "a").tableIds[0] === "premier", "party 2 → table priority_order 1 avant priority_order 2");
}

// --- sans priority_order : le moteur suit l'ordre des tables reçues ---
{
  const mk = (ids) => ({
    tables: ids.map((id) => ({ id, active: true, capacityPreferred: 2, capacityMax: 2 })),
    combinations: [],
    reservations: [R("a", 2, 1140)],
  });
  ok(asgOf(solve(mk(["T1", "T9"])), "a").tableIds[0] === "T1", "aucune priorité, [T1,T9] → T1");
  ok(asgOf(solve(mk(["T9", "T1"])), "a").tableIds[0] === "T9", "aucune priorité, [T9,T1] → T9 (suit l'entrée, le client trie en amont)");
}

// --- priority_order partiel : les tables sans priorité passent après ---
{
  const r = solve({
    tables: [
      { id: "sans", active: true, capacityPreferred: 2, capacityMax: 2 },
      { id: "avec", active: true, capacityPreferred: 2, capacityMax: 2, priorityOrder: 5 },
    ],
    combinations: [],
    reservations: [R("a", 2, 1140)],
  });
  ok(asgOf(r, "a").tableIds[0] === "avec", "table avec priority_order passe avant une table sans");
}

// --- combinaison habituelle vs exceptionnelle (pénalité égale) ---
{
  const r = solve({
    tables: [T("a", 2), T("b", 2), T("c", 2), T("d", 2)],
    combinations: [
      { id: "exc", tableIds: ["a", "b"], capacity: 4, isUsual: false, penaltyScore: 0 },
      { id: "hab", tableIds: ["c", "d"], capacity: 4, isUsual: true, penaltyScore: 0 },
    ],
    reservations: [R("x", 4, 1140)],
  });
  ok(asgOf(r, "x").comboId === "hab", "combi habituelle préférée à l'exceptionnelle (penalty_score égal)");
}
{
  // exceptionnelle seule → quand même acceptée
  const r = solve({
    tables: [T("a", 2), T("b", 2)],
    combinations: [{ id: "exc", tableIds: ["a", "b"], capacity: 4, isUsual: false, penaltyScore: 0 }],
    reservations: [R("x", 4, 1140)],
  });
  ok(r.accepted === 1 && asgOf(r, "x").comboId === "exc", "combi exceptionnelle seule → utilisée");
}
{
  // une table de l'habituelle occupée → repli sur l'exceptionnelle
  const r = solve({
    tables: [T("a", 2), T("b", 2), T("c", 2), T("d", 2)],
    combinations: [
      { id: "hab", tableIds: ["c", "d"], capacity: 4, isUsual: true, penaltyScore: 0 },
      { id: "exc", tableIds: ["a", "b"], capacity: 4, isUsual: false, penaltyScore: 0 },
    ],
    reservations: [R("blk", 2, 1140, 120), R("x", 4, 1140, 120)],
    pinned: { blk: { tableIds: ["c"], capacity: 2 } },
  });
  ok(asgOf(r, "x").comboId === "exc", "table de l'habituelle occupée → repli sur l'exceptionnelle");
}

// --- preferredLayoutId : la réservation est restreinte à sa zone ---
{
  const tables = [
    { id: "s1", active: true, capacityPreferred: 4, capacityMax: 4, layoutId: "salle" },
    { id: "t1", active: true, capacityPreferred: 4, capacityMax: 4, layoutId: "terrasse" },
  ];
  const Z = (id, pref) => ({ id, partySize: 4, startMin: 1140, durationMin: 120, preferredLayoutId: pref });

  const r = solve({ tables, combinations: [], reservations: [Z("a", "terrasse")] });
  ok(asgOf(r, "a").tableIds[0] === "t1", "résa zone terrasse → table terrasse");

  const r2 = solve({ tables, combinations: [], reservations: [Z("occ", "terrasse"), Z("a", "terrasse")] });
  ok(r2.unassigned.includes("a"), "zone terrasse pleine → non placée (pas de repli en salle)");

  const r3 = solve({ tables, combinations: [], reservations: [{ id: "a", partySize: 4, startMin: 1140, durationMin: 90 }] });
  ok(r3.accepted === 1, "sans preferredLayoutId → placée (n'importe quelle zone)");
}
{
  const tables = [
    { id: "s1", active: true, capacityPreferred: 2, capacityMax: 2, layoutId: "salle" },
    { id: "t1", active: true, capacityPreferred: 2, capacityMax: 2, layoutId: "terrasse" },
    { id: "t2", active: true, capacityPreferred: 2, capacityMax: 2, layoutId: "terrasse" },
  ];
  const combos = [
    { id: "mix", tableIds: ["s1", "t1"], capacity: 4, isUsual: true, penaltyScore: 0 },
    { id: "terr", tableIds: ["t1", "t2"], capacity: 4, isUsual: true, penaltyScore: 0 },
  ];
  const r = solve({
    tables,
    combinations: combos,
    reservations: [{ id: "a", partySize: 4, startMin: 1140, durationMin: 90, preferredLayoutId: "terrasse" }],
  });
  ok(asgOf(r, "a").comboId === "terr", "combo à cheval sur 2 zones exclu → combo 100% terrasse");
}

console.log(`\noptimizer: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
