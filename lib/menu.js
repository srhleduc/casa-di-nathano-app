// Structure du menu (catégories, parfums, desserts à stock limité) — le
// contenu du menu lui-même (produits, prix, recettes) vit en base dans la
// table `menu_items` (voir lib/data.js#useMenu), entièrement éditable depuis
// Logistique → Menu.

export const CATEGORIES = [
  { key: "pizza", label: "Pizzas", emoji: "🍕" },
  { key: "panuzzo", label: "Panuzzo", emoji: "🥙" },
  { key: "antipasti", label: "Antipasti", emoji: "🥖" },
  { key: "salade", label: "Salades", emoji: "🥗" },
  { key: "boisson", label: "Boissons", emoji: "🥤" },
  { key: "biere", label: "Bières", emoji: "🍺" },
  { key: "vin", label: "Vins", emoji: "🍷" },
  { key: "cocktail", label: "Cocktails", emoji: "🍸" },
  { key: "cafe", label: "Café/Thés", emoji: "☕" },
  { key: "dessert", label: "Desserts", emoji: "🍰" },
];

// Formule du midi (panuzzo + boisson + dessert) — vraiment que le midi,
// masquée de la borne/équipe passé cette heure (coïncide avec la fin de la
// plage des créneaux midi, 12h-15h).
export const PANUZZO_CUTOFF_HOUR = 15;

export const FORMULE_PRICE = 14.5;
export const FORMULE_DRINK_INCLUDED_MAX = 3.7;
export const FORMULE_DRINK_SUPPLEMENT = 1.5;
export const FORMULE_DESSERT_INCLUDED_MAX = 6.3;

const FORMULE_DRINK_CATS = ["boisson", "biere", "vin", "cocktail"];
// Exclut les grands formats à partager (bouteilles d'1L, bouteilles de vin) —
// seuls les formats individuels (verre, canette, bouteille de bière...) sont
// proposables dans la formule.
export function isFormuleEligibleDrink(item) {
  if (!FORMULE_DRINK_CATS.includes(item.cat)) return false;
  if (item.name.includes("1L")) return false;
  if (item.name.includes("(bouteille)")) return false;
  return true;
}
export function formuleDrinkSupplement(item) {
  return item.price > FORMULE_DRINK_INCLUDED_MAX ? FORMULE_DRINK_SUPPLEMENT : 0;
}
export function formuleDessertSupplement(item) {
  return Math.max(0, item.price - FORMULE_DESSERT_INCLUDED_MAX);
}

export function slugify(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Id stable pour un nouveau produit créé depuis l'admin — même schéma que les
// produits d'origine (cat-slug), avec un court suffixe pour éviter toute
// collision si deux produits finissent avec le même nom dans la même catégorie.
export function newMenuItemId(cat, name) {
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${cat}-${slugify(name)}-${suffix}`;
}

// Stock du jour pour certains desserts — le coulis étant ajouté indépendamment,
// les deux Pana Cotta partagent un même stock ; les Tiramisu sont comptés séparément.
export const DESSERT_STOCK_GROUPS = [
  { key: "pannacotta", label: "Panna Cotta", itemNames: ["Pana Cotta Framboise", "Pana Cotta Mangue"] },
  { key: "tiramisu_cafe", label: "Tiramisu Café", itemNames: ["Tiramisu Café"] },
  { key: "tiramisu_speculoos", label: "Tiramisu Spéculoos", itemNames: ["Tiramisu Spéculoos"] },
  { key: "paris_palerme", label: "Paris Palerme", itemNames: ["Paris Palerme"] },
];

export const GLACE_FLAVORS = ["Vanille", "Fior di latte", "Chocolat", "Stracciatella", "Cerise amarena", "Citron", "Noisette", "Pistache", "Fraise"];
export const SIROP_FLAVORS = ["Fraise", "Framboise", "Pêche", "Menthe", "Grenadine", "Vanille", "Citron", "Mojito", "Litchi", "Yuzu", "Caramel", "Fruit de la passion", "Basilic", "Orgeat"];

export function flavorConfigFor(name) {
  if (name === "Glace 1 boule") return { flavors: GLACE_FLAVORS, need: 1, icon: "🍨" };
  if (name === "Glace 2 boules") return { flavors: GLACE_FLAVORS, need: 2, icon: "🍨" };
  if (name === "Glace 3 boules") return { flavors: GLACE_FLAVORS, need: 3, icon: "🍨" };
  if (name === "Sirop à l'eau") return { flavors: SIROP_FLAVORS, need: 1, icon: "💧" };
  if (name === "Diabolo") return { flavors: SIROP_FLAVORS, need: 1, icon: "💧" };
  return null;
}

export const eur = (n) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

let localUid = 0;
// Ids locaux uniquement (paniers, tables du plan de salle avant enregistrement) —
// jamais persistés tels quels : les commandes reçoivent leur id définitif de
// Postgres (gen_random_uuid()) à l'insertion.
export const nextLocalId = (p) => `${p}-${Date.now()}-${localUid++}`;
