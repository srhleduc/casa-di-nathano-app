// Tests de la grille de plan de salle. Lancer : node lib/reservation/grid.test.mjs
import { isSplit, cellCode, collapseCell, normalizeGrid, expandTo35 } from "./grid.js";

let passed = 0;
let failed = 0;
function ok(cond, name) {
  if (cond) passed++;
  else {
    failed++;
    console.error("  ✗ " + name);
  }
}
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), `${name} (got ${JSON.stringify(a)})`);

ok(isSplit({ s: "v", a: "T", b: "P" }) && !isSplit("T") && !isSplit("empty"), "isSplit");
ok(cellCode({ s: "h", a: "P", b: "T" }) === "P" && cellCode("W") === "W" && cellCode("xxx") === "empty", "cellCode");
eq(collapseCell({ s: "v", a: "P", b: "P" }), "P", "collapseCell recolle deux moitiés égales");
eq(collapseCell({ s: "v", a: "P", b: "T" }), { s: "v", a: "P", b: "T" }, "collapseCell garde une demi-case réelle");

// normalizeGrid : dimensions + nettoyage
{
  const g = normalizeGrid([["T", "bad", { s: "v", a: "P", b: "P" }]], 2, 4);
  eq(g.length, 2, "normalizeGrid : 2 lignes");
  eq(g[0], ["T", "empty", "P", "empty"], "normalizeGrid : code invalide → empty, demi-case égale → recollée, padding");
  eq(g[1], ["empty", "empty", "empty", "empty"], "normalizeGrid : ligne manquante → vide");
}

// expandTo35 : 70 cm → 35 cm ×2
{
  const layout = { gridRows: 2, gridCols: 2, cellSizeCm: 70, cells: [["T", { s: "v", a: "P", b: "empty" }], [{ s: "h", a: "D", b: "W" }, "empty"]] };
  const g = expandTo35(layout);
  eq([g.gridRows, g.gridCols, g.scale, g.cellSizeCm], [4, 4, 2, 35], "expandTo35 : 2×2 @70 → 4×4 @35");
  eq(g.cells[0], ["T", "T", "P", "empty"], "ligne 0 : table pleine + coupe verticale (gauche P / droite vide)");
  eq(g.cells[1], ["T", "T", "P", "empty"], "ligne 1 : identique (coupe verticale = mêmes colonnes sur les 2 sous-lignes)");
  eq(g.cells[2], ["D", "D", "empty", "empty"], "ligne 2 : coupe horizontale, moitié haute = D");
  eq(g.cells[3], ["W", "W", "empty", "empty"], "ligne 3 : coupe horizontale, moitié basse = W");
}

// grille déjà en 35 cm → scale 1, pass-through
{
  const g = expandTo35({ gridRows: 1, gridCols: 2, cellSizeCm: 35, cells: [["P", "T"]] });
  eq([g.gridRows, g.gridCols, g.scale], [1, 2, 1], "expandTo35 : grille 35 cm inchangée");
  eq(g.cells[0], ["P", "T"], "cases inchangées");
}

console.log(`\ngrid: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
