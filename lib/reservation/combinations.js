// Génération de combinaisons de tables candidates à partir des relations
// physiques saisies par l'équipe (combinable_with / usually_combined_with /
// non_combinable_with). Pur, sans I/O — sert l'admin (proposition auto) et,
// plus tard, le moteur d'optimisation.

// Deux tables sont *combinables* si l'une cite l'autre dans combinableWith ou
// usuallyCombinedWith, et qu'aucune ne cite l'autre dans nonCombinableWith.
function pairCombinable(a, b) {
  const aRefsB = (a.combinableWith || []).includes(b.id) || (a.usuallyCombinedWith || []).includes(b.id);
  const bRefsA = (b.combinableWith || []).includes(a.id) || (b.usuallyCombinedWith || []).includes(a.id);
  const forbidden = (a.nonCombinableWith || []).includes(b.id) || (b.nonCombinableWith || []).includes(a.id);
  return (aRefsB || bRefsA) && !forbidden;
}

// Paire *habituelle* (config standard de la salle) : au moins l'une cite
// l'autre dans usuallyCombinedWith.
function pairUsual(a, b) {
  return (a.usuallyCombinedWith || []).includes(b.id) || (b.usuallyCombinedWith || []).includes(a.id);
}

function keyOf(ids) {
  return [...ids].sort().join("|");
}

// Renvoie les combinaisons candidates (taille 2 et 3) où chaque paire est
// combinable, en excluant celles déjà enregistrées. capacity = somme des
// capacity_base ; isUsual si toutes les paires sont habituelles ;
// penaltyScore 0 si habituelle, 10 sinon (ajustable ensuite par l'équipe).
export function suggestCombinations(tables, existingCombinations = []) {
  const active = tables.filter((t) => t.active);
  const existing = new Set(existingCombinations.map((c) => keyOf(c.tableIds || [])));
  const out = [];
  const seen = new Set();

  function consider(group) {
    // toutes les paires du groupe doivent être combinables
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (!pairCombinable(group[i], group[j])) return;
      }
    }
    const ids = group.map((t) => t.id);
    const k = keyOf(ids);
    if (existing.has(k) || seen.has(k)) return;
    seen.add(k);
    let isUsual = true;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (!pairUsual(group[i], group[j])) isUsual = false;
      }
    }
    out.push({
      tableIds: [...ids].sort(),
      capacity: group.reduce((s, t) => s + (t.capacityBase || 2), 0),
      isUsual,
      penaltyScore: isUsual ? 0 : 10,
    });
  }

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      consider([active[i], active[j]]);
      for (let k = j + 1; k < active.length; k++) consider([active[i], active[j], active[k]]);
    }
  }

  return out.sort(
    (a, b) => Number(b.isUsual) - Number(a.isUsual) || a.tableIds.length - b.tableIds.length || a.capacity - b.capacity
  );
}
