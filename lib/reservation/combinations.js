// Combinaisons de tables : proposition automatique + validation à l'écriture.
// Pur, sans I/O.
//
// La combinabilité est DÉCLARATIVE, pas géométrique : chaque table cite
// manuellement les tables qu'elle peut être amenée à rejoindre
// (combinable_with / usually_combined_with), même si elles ne sont pas
// voisines au repos sur le plan — l'équipe peut les rapprocher en salle.
//
// Un groupe de 2 tables ou plus est une combinaison VALIDE s'il forme une
// CHAÎNE CONNECTÉE dans ce graphe : chaque table reliée à au moins une autre
// du groupe, directement ou de proche en proche. Pas besoin que toutes les
// paires soient déclarées combinables. non_combinable_with reste une exception
// qui bloque toute combinaison incluant cette paire précise.

// Arête du graphe : l'une cite l'autre (combinable_with ou usually_combined_with)
// et aucune ne la marque « jamais combinée ».
function pairCombinable(a, b) {
  if (!a || !b) return false;
  const aRefsB = (a.combinableWith || []).includes(b.id) || (a.usuallyCombinedWith || []).includes(b.id);
  const bRefsA = (b.combinableWith || []).includes(a.id) || (b.usuallyCombinedWith || []).includes(a.id);
  const forbidden = (a.nonCombinableWith || []).includes(b.id) || (b.nonCombinableWith || []).includes(a.id);
  return (aRefsB || bRefsA) && !forbidden;
}

// Paire *habituelle* (config standard de la salle).
function pairUsual(a, b) {
  return (a.usuallyCombinedWith || []).includes(b.id) || (b.usuallyCombinedWith || []).includes(a.id);
}

// Une paire est-elle explicitement interdite ?
function pairForbidden(a, b) {
  return (a?.nonCombinableWith || []).includes(b?.id) || (b?.nonCombinableWith || []).includes(a?.id);
}

// Le groupe est-il connecté dans le graphe combinable_with (BFS) ?
function graphConnected(group) {
  if (group.length <= 1) return true;
  const seen = new Set([group[0].id]);
  const stack = [group[0]];
  while (stack.length) {
    const cur = stack.pop();
    for (const other of group) {
      if (seen.has(other.id)) continue;
      if (pairCombinable(cur, other)) {
        seen.add(other.id);
        stack.push(other);
      }
    }
  }
  return seen.size === group.length;
}

function keyOf(ids) {
  return [...ids].sort().join("|");
}

// Valide un groupe avant enregistrement dans table_combinations.
// nameOf(id) : optionnel, pour un message lisible.
export function validateCombination(tableIds, tables, nameOf = (id) => id) {
  const ids = [...new Set(tableIds || [])];
  if (ids.length < 2) return { ok: false, reason: "Sélectionne au moins 2 tables." };
  const byId = Object.fromEntries((tables || []).map((t) => [t.id, t]));
  const group = ids.map((id) => byId[id]).filter(Boolean);
  if (group.length !== ids.length) return { ok: false, reason: "Table inconnue dans la sélection." };

  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      if (pairForbidden(group[i], group[j])) {
        return { ok: false, reason: `${nameOf(group[i].id)} et ${nameOf(group[j].id)} sont marquées « jamais combinées ».` };
      }
    }
  }
  if (!graphConnected(group)) {
    return {
      ok: false,
      reason:
        "Ces tables ne forment pas une chaîne : chacune doit pouvoir être rapprochée d'au moins une autre du groupe (directement ou de proche en proche). Complète « Peut être rapprochée de » dans l'onglet Tables.",
    };
  }
  return { ok: true };
}

// Combinaisons candidates (taille 2 et 3) : groupe connecté dans le graphe,
// sans paire interdite, non déjà enregistré. capacity = somme des couverts ;
// isUsual si toutes les paires sont habituelles ; pénalité 0 si habituelle,
// 10 sinon (ajustable ensuite par l'équipe).
export function suggestCombinations(tables, existingCombinations = []) {
  const active = (tables || []).filter((t) => t.active);
  const existing = new Set((existingCombinations || []).map((c) => keyOf(c.tableIds || [])));
  const out = [];
  const seen = new Set();

  function consider(group) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (pairForbidden(group[i], group[j])) return;
      }
    }
    if (!graphConnected(group)) return;
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
