// Grille de plan de salle. Unité de base = une TABLE (70 cm) : une case = une
// table. Une case peut être coupée en deux demi-cases (35 cm) pour les
// ajustements fins de largeur de passage — représentée alors par un objet
// { s, a, b } au lieu d'un simple code :
//   s = "v" : coupe verticale   → a = moitié gauche, b = moitié droite
//   s = "h" : coupe horizontale → a = moitié haute,  b = moitié basse
// Codes : empty / S (siège) / P (passage) / T (table) / D (porte) / W (travail).

export const CELL_CODES = ["empty", "S", "P", "T", "D", "W"];
const VALID = new Set(CELL_CODES);

export function isSplit(cell) {
  return cell != null && typeof cell === "object" && (cell.s === "v" || cell.s === "h");
}

// Code « dominant » d'une case (pour un rendu simple / une pastille).
export function cellCode(cell) {
  if (isSplit(cell)) return cell.a;
  return VALID.has(cell) ? cell : "empty";
}

// Recolle une demi-case dont les deux moitiés sont identiques.
export function collapseCell(cell) {
  if (isSplit(cell) && cell.a === cell.b) return cell.a;
  return cell;
}

function cleanCell(cell) {
  if (isSplit(cell)) {
    const a = VALID.has(cell.a) ? cell.a : "empty";
    const b = VALID.has(cell.b) ? cell.b : "empty";
    return a === b ? a : { s: cell.s, a, b };
  }
  return VALID.has(cell) ? cell : "empty";
}

// Force `cells` en matrice rows×cols de cases valides (codes ou demi-cases).
export function normalizeGrid(cells, rows, cols) {
  const out = [];
  for (let r = 0; r < rows; r++) {
    const src = Array.isArray(cells) && Array.isArray(cells[r]) ? cells[r] : [];
    const row = [];
    for (let c = 0; c < cols; c++) row.push(cleanCell(src[c]));
    out.push(row);
  }
  return out;
}

function subCode(cell, sr, sc, scale) {
  if (!isSplit(cell)) return cellCode(cell);
  const half = scale / 2;
  if (cell.s === "v") return sc < half ? cell.a : cell.b;
  return sr < half ? cell.a : cell.b;
}

// Détaille la grille (70 cm + demi-cases) en une grille uniforme de 35 cm —
// c'est sur cette grille que le moteur de contraintes raisonne (largeurs de
// passage précises). `scale` = cellSizeCm / 35 (2 par défaut, 1 pour une
// ancienne grille déjà en 35 cm).
export function expandTo35(layout) {
  const R = layout.gridRows || 0;
  const C = layout.gridCols || 0;
  const scale = Math.max(1, Math.round((layout.cellSizeCm || 70) / 35));
  const src = layout.cells || [];
  const out = [];
  for (let r = 0; r < R; r++) {
    for (let sr = 0; sr < scale; sr++) {
      const row = [];
      for (let c = 0; c < C; c++) {
        const cell = src[r]?.[c] ?? "empty";
        for (let sc = 0; sc < scale; sc++) row.push(subCode(cell, sr, sc, scale));
      }
      out.push(row);
    }
  }
  return { gridRows: R * scale, gridCols: C * scale, cellSizeCm: 35, cells: out, scale };
}
