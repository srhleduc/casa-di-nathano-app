// Moteur de contraintes du module Réservation — pur, sans I/O.
//
// Vérifie qu'une disposition de tables sur un plan quadrillé respecte :
//  - les contraintes ABSOLUES (rejet si violées) : table hors grille, table
//    sur une porte, chevauchement de tables, passage obligatoire coupé ou
//    trop étroit ;
//  - les PRÉFÉRENCES (pénalité sans rejet) : passage recommandé coupé, table
//    posée sur une zone travail/attente, combinaison habituelle séparée.
//
// Point clé du cahier des charges (§4) : un « passage » n'est PAS une liste
// de cases figées, c'est une contrainte de connectivité entre deux points.
// Le moteur raisonne sur l'existence d'un chemin (largeur mini incluse), pas
// sur la conservation d'un tracé.

const DEFAULT_CELL_CM = 35;
const TABLE_CM = 70;

// Nombre de cases occupées par une table sur un axe (70 cm → 2 cases à 35).
export function tableSpan(layout) {
  const cm = layout?.cellSizeCm || DEFAULT_CELL_CM;
  return Math.max(1, Math.round(TABLE_CM / cm));
}

// Cases [r, c] couvertes par une table placée (ancre = coin haut-gauche).
export function tableFootprint(table, layout) {
  const span = tableSpan(layout);
  const cells = [];
  for (let dr = 0; dr < span; dr++) {
    for (let dc = 0; dc < span; dc++) {
      cells.push([table.gridRow + dr, table.gridCol + dc]);
    }
  }
  return cells;
}

const key = (r, c) => `${r},${c}`;

function inGrid(layout, r, c) {
  return r >= 0 && c >= 0 && r < layout.gridRows && c < layout.gridCols;
}

function codeAt(layout, r, c) {
  return inGrid(layout, r, c) ? (layout.cells?.[r]?.[c] || "empty") : null;
}

// Ensemble des cases occupées par au moins une table (clé "r,c").
export function buildBlockedSet(tables, layout) {
  const blocked = new Set();
  for (const t of tables) {
    for (const [r, c] of tableFootprint(t, layout)) blocked.add(key(r, c));
  }
  return blocked;
}

// Deux tables sont physiquement collées si leurs gabarits partagent un bord.
export function footprintsAdjacent(a, b, layout) {
  const bCells = new Set(tableFootprint(b, layout).map(([r, c]) => key(r, c)));
  for (const [r, c] of tableFootprint(a, layout)) {
    if (bCells.has(key(r + 1, c)) || bCells.has(key(r - 1, c)) || bCells.has(key(r, c + 1)) || bCells.has(key(r, c - 1))) {
      return true;
    }
  }
  return false;
}

// Une case est libre pour la circulation si elle est dans la grille et non
// couverte par une table. Les codes (S / P / W / D / empty) ne bloquent pas :
// seul un gabarit de table est un obstacle (cf. §4 du cahier des charges).
function freeCell(layout, blocked, r, c) {
  return inGrid(layout, r, c) && !blocked.has(key(r, c));
}

// Un bloc width×width ancré en (r, c) est entièrement libre.
function blockFree(layout, blocked, r, c, width) {
  for (let dr = 0; dr < width; dr++) {
    for (let dc = 0; dc < width; dc++) {
      if (!freeCell(layout, blocked, r + dr, c + dc)) return false;
    }
  }
  return true;
}

// Existe-t-il un chemin d'une largeur >= `width` entre les cases `a` et `b` ?
// BFS sur les ancres de blocs width×width libres (4-connexité : décaler le
// bloc d'une case conserve la continuité car les blocs se recouvrent).
export function pathExistsWithWidth(layout, blocked, a, b, width = 1) {
  const w = Math.max(1, width);
  // ancres de blocs contenant la case a / la case b
  const starts = [];
  const goals = new Set();
  for (let dr = -(w - 1); dr <= 0; dr++) {
    for (let dc = -(w - 1); dc <= 0; dc++) {
      const sr = a.row + dr;
      const sc = a.col + dc;
      if (blockFree(layout, blocked, sr, sc, w)) starts.push([sr, sc]);
      const gr = b.row + dr;
      const gc = b.col + dc;
      if (blockFree(layout, blocked, gr, gc, w)) goals.add(key(gr, gc));
    }
  }
  if (starts.length === 0 || goals.size === 0) return false;

  const seen = new Set(starts.map(([r, c]) => key(r, c)));
  const queue = [...starts];
  while (queue.length) {
    const [r, c] = queue.shift();
    if (goals.has(key(r, c))) return true;
    for (const [nr, nc] of [
      [r + 1, c],
      [r - 1, c],
      [r, c + 1],
      [r, c - 1],
    ]) {
      const k = key(nr, nc);
      if (seen.has(k)) continue;
      if (blockFree(layout, blocked, nr, nc, w)) {
        seen.add(k);
        queue.push([nr, nc]);
      }
    }
  }
  return false;
}

function endpoint(ep) {
  return { row: ep?.row ?? ep?.r ?? 0, col: ep?.col ?? ep?.c ?? 0 };
}

// Évalue une disposition complète. `placedTables` : uniquement les tables
// posées (gridRow / gridCol non nuls). `circulationConstraints` : lignes de
// circulation_constraints. `combinations` : lignes table_combinations (pour
// la pénalité « combinaison habituelle séparée »).
export function evaluateConstraints(layout, placedTables, circulationConstraints = [], { combinations = [] } = {}) {
  const violations = [];
  const notes = [];
  let penalty = 0;

  const placed = (placedTables || []).filter((t) => t.gridRow != null && t.gridCol != null);

  // --- absolues : position des tables ---
  const seenCells = new Map(); // "r,c" -> tableId
  for (const t of placed) {
    for (const [r, c] of tableFootprint(t, layout)) {
      if (!inGrid(layout, r, c)) {
        violations.push({ type: "off-grid", tableId: t.id, message: `Table hors du plan.` });
        break;
      }
    }
    for (const [r, c] of tableFootprint(t, layout)) {
      if (codeAt(layout, r, c) === "D") {
        violations.push({ type: "on-door", tableId: t.id, message: `Table posée sur une porte.` });
        break;
      }
      if (codeAt(layout, r, c) === "W") {
        penalty += 20;
        notes.push(`Table sur une zone travail/attente.`);
        break;
      }
    }
    for (const [r, c] of tableFootprint(t, layout)) {
      const k = key(r, c);
      if (seenCells.has(k) && seenCells.get(k) !== t.id) {
        violations.push({ type: "overlap", tableId: t.id, message: `Chevauchement de tables.` });
      }
      seenCells.set(k, t.id);
    }
  }

  // --- circulation : connectivité + largeur ---
  const blocked = buildBlockedSet(placed, layout);
  for (const cc of circulationConstraints || []) {
    const a = endpoint(cc.endpointA || cc.endpoint_a);
    const b = endpoint(cc.endpointB || cc.endpoint_b);
    const width = cc.minWidthCells ?? cc.min_width_cells ?? 1;
    const ok = pathExistsWithWidth(layout, blocked, a, b, width);
    if (ok) continue;
    const prio = cc.priority || "obligatoire";
    if (prio === "obligatoire") {
      violations.push({ type: "blocked-passage", constraintId: cc.id, message: `Passage « ${cc.name} » coupé ou trop étroit.` });
    } else if (prio === "fortement_recommande") {
      penalty += 50;
      notes.push(`Passage « ${cc.name} » (fortement recommandé) non praticable.`);
    } else {
      penalty += 15;
      notes.push(`Passage « ${cc.name} » (préférable) non praticable.`);
    }
  }

  // --- préférence : combinaison habituelle séparée ---
  const byId = new Map(placed.map((t) => [t.id, t]));
  for (const combo of combinations || []) {
    if (!combo.isUsual) continue;
    const ts = (combo.tableIds || []).map((id) => byId.get(id)).filter(Boolean);
    if (ts.length < 2 || ts.length !== (combo.tableIds || []).length) continue; // pas toutes posées
    // chaque table doit toucher au moins une autre du groupe
    const allTouch = ts.every((t) => ts.some((o) => o.id !== t.id && footprintsAdjacent(t, o, layout)));
    if (!allTouch) {
      penalty += combo.penaltyScore || 10;
      notes.push(`Combinaison habituelle séparée (${combo.tableIds.length} tables).`);
    }
  }

  return { valid: violations.length === 0, violations, penalty, notes };
}
