// Tests du moteur de contraintes. Lancer : node lib/reservation/constraints.test.mjs
import {
  tableSpan,
  tableFootprint,
  buildBlockedSet,
  footprintsAdjacent,
  pathExistsWithWidth,
  evaluateConstraints,
} from "./constraints.js";

let passed = 0;
let failed = 0;
function ok(cond, name) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error("  ✗ " + name);
  }
}
function eq(a, b, name) {
  ok(JSON.stringify(a) === JSON.stringify(b), `${name} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
}

// Grille utilitaire : n×n de cases "empty", overrides = { "r,c": code }
function grid(n, overrides = {}) {
  const cells = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => overrides[`${r},${c}`] || "empty"));
  return { gridRows: n, gridCols: n, cellSizeCm: 35, cells };
}
const T = (id, gridRow, gridCol) => ({ id, gridRow, gridCol });

// --- gabarit ---
{
  const L = grid(6);
  eq(tableSpan(L), 2, "span 70cm/35cm = 2");
  eq(tableFootprint(T("a", 1, 2), L).sort(), [[1, 2], [1, 3], [2, 2], [2, 3]].sort(), "footprint 2x2");
  eq(tableSpan({ cellSizeCm: 70 }), 1, "span 70cm/70cm = 1");
}

// --- chevauchement / hors grille / porte ---
{
  const L = grid(8);
  let r = evaluateConstraints(L, [T("a", 1, 1), T("b", 2, 2)], []);
  ok(!r.valid && r.violations.some((v) => v.type === "overlap"), "tables qui se chevauchent → invalide");

  r = evaluateConstraints(L, [T("a", 7, 7)], []);
  ok(!r.valid && r.violations.some((v) => v.type === "off-grid"), "table hors grille → invalide");

  const Ld = grid(8, { "3,3": "D" });
  r = evaluateConstraints(Ld, [T("a", 2, 2)], []);
  ok(!r.valid && r.violations.some((v) => v.type === "on-door"), "table sur une porte → invalide");

  const Lw = grid(8, { "2,2": "W" });
  r = evaluateConstraints(Lw, [T("a", 2, 2)], []);
  ok(r.valid && r.penalty >= 20, "table sur zone travail → valide mais pénalisée");
}

// --- pathExistsWithWidth (grille à cases de 70 cm → tables 1×1, murs précis) ---
{
  const L = { ...grid(7), cellSizeCm: 70 };
  const a = { row: 0, col: 0 };
  const b = { row: 6, col: 6 };
  ok(pathExistsWithWidth(L, new Set(), a, b, 1), "grille vide : chemin largeur 1");
  ok(pathExistsWithWidth(L, new Set(), a, b, 2), "grille vide : chemin largeur 2");

  // mur complet sur la ligne 3 (cols 0..6) → aucun chemin
  const wall = buildBlockedSet([0, 1, 2, 3, 4, 5, 6].map((c) => T("w" + c, 3, c)), L);
  ok(!pathExistsWithWidth(L, wall, a, b, 1), "mur complet : aucun chemin");

  // brèche d'1 case en (3,3) : largeur 1 OK, largeur 2 KO
  const gap = buildBlockedSet([0, 1, 2, 4, 5, 6].map((c) => T("w" + c, 3, c)), L);
  ok(pathExistsWithWidth(L, gap, a, b, 1), "brèche 1 case : chemin largeur 1");
  ok(!pathExistsWithWidth(L, gap, a, b, 2), "brèche 1 case : pas de chemin largeur 2");

  // brèche de 2 cases en (3,3)-(3,4) : largeur 2 OK
  const gap2 = buildBlockedSet([0, 1, 2, 5, 6].map((c) => T("w" + c, 3, c)), L);
  ok(pathExistsWithWidth(L, gap2, a, b, 2), "brèche 2 cases : chemin largeur 2");
}

// --- circulation_constraints : priorité ---
{
  const L = { ...grid(7), cellSizeCm: 70 };
  const wallTables = [0, 1, 2, 3, 4, 5, 6].map((c) => T("w" + c, 3, c));
  const cc = (priority) => [{ id: "c1", name: "Accès WC", endpointA: { row: 0, col: 0 }, endpointB: { row: 6, col: 6 }, minWidthCells: 1, priority }];

  let r = evaluateConstraints(L, wallTables, cc("obligatoire"));
  ok(!r.valid && r.violations.some((v) => v.type === "blocked-passage"), "passage obligatoire coupé → invalide");

  r = evaluateConstraints(L, wallTables, cc("preferable"));
  ok(r.valid && r.penalty >= 15 && r.notes.length > 0, "passage préférable coupé → valide + pénalité + note");

  r = evaluateConstraints(L, [T("x", 0, 4)], cc("obligatoire"));
  ok(r.valid, "passage obligatoire libre → valide");
}

// --- footprintsAdjacent + combinaison habituelle séparée ---
{
  const L = grid(8);
  ok(footprintsAdjacent(T("a", 1, 1), T("b", 1, 3), L), "tables collées (côte à côte) → adjacentes");
  ok(!footprintsAdjacent(T("a", 1, 1), T("b", 1, 4), L), "tables à 1 case d'écart → non adjacentes");

  const combos = [{ id: "k1", tableIds: ["a", "b"], isUsual: true, penaltyScore: 10 }];
  let r = evaluateConstraints(L, [T("a", 1, 1), T("b", 1, 4)], [], { combinations: combos });
  ok(r.valid && r.penalty >= 10 && r.notes.some((n) => n.includes("habituelle")), "combi habituelle séparée → pénalité + note");

  r = evaluateConstraints(L, [T("a", 1, 1), T("b", 1, 3)], [], { combinations: combos });
  ok(r.valid && r.penalty === 0, "combi habituelle collée → aucune pénalité");
}

console.log(`\nconstraints: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
