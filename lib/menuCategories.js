// Logique pure des catégories de menu gérables en Direction (voir
// lib/data.js#useMenuCategories et supabase/migrations_manual/menu_categories.sql).
// Les 10 catégories d'origine (CATEGORIES, lib/menu.js) restent la base : elles
// ne disparaissent jamais, même si la table est vide ou absente — on peut
// seulement les désactiver. Les catégories créées par la Direction s'ajoutent.

import { CATEGORIES, slugify } from "./menu.js";

// Clés que la logique métier utilise en dur (four, suppléments de pizza…) :
// une catégorie créée ne peut pas les reprendre.
const RESERVED_KEYS = ["supplement", "sans"];

export const isBuiltinCategory = (key) => CATEGORIES.some((c) => c.key === key);

// Toutes les catégories (actives ou non), prêtes à afficher :
// [{ key, label, emoji, active, builtin, sortOrder }]. Lignes en base triées par
// `sortOrder` ; une catégorie d'origine absente de la base est ajoutée à la fin
// (active) pour qu'aucun produit existant ne devienne orphelin.
export function buildCategoryList(rows) {
  const out = [];
  const seen = new Set();
  const sorted = [...(rows || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  for (const r of sorted) {
    if (!r.key || seen.has(r.key)) continue;
    seen.add(r.key);
    out.push({
      key: r.key,
      label: r.label,
      emoji: r.emoji || "🏷️",
      active: r.active !== false,
      builtin: isBuiltinCategory(r.key),
      sortOrder: r.sortOrder ?? 0,
    });
  }
  let next = out.reduce((m, c) => Math.max(m, c.sortOrder), -1) + 1;
  for (const c of CATEGORIES) {
    if (seen.has(c.key)) continue;
    out.push({ key: c.key, label: c.label, emoji: c.emoji, active: true, builtin: true, sortOrder: next++ });
  }
  return out;
}

// Clé d'une nouvelle catégorie : le nom « slugifié », suffixé -2, -3… si elle
// existe déjà (ou est réservée).
export function uniqueCategoryKey(label, existingKeys = []) {
  const taken = new Set([...existingKeys, ...RESERVED_KEYS]);
  const base = slugify(String(label || "")) || "categorie";
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
