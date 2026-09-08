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

// Réordonne CATEGORIES selon une liste de clés enregistrée (table
// category_order, éditée depuis l'espace Direction) : les catégories citées
// d'abord, dans cet ordre ; toute catégorie absente de la liste (nouvelle
// catégorie ajoutée après coup) est ajoutée à la fin dans son ordre naturel.
// Liste vide / absente → ordre naturel inchangé.
export function orderedCategories(savedKeys) {
  const saved = Array.isArray(savedKeys) ? savedKeys : [];
  const byKey = new Map(CATEGORIES.map((c) => [c.key, c]));
  const out = [];
  for (const k of saved) {
    if (byKey.has(k)) {
      out.push(byKey.get(k));
      byKey.delete(k);
    }
  }
  for (const c of CATEGORIES) if (byKey.has(c.key)) out.push(c);
  return out;
}

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
// Panna Cotta et Tiramisu sont préparés dans des contenants différents (donc en
// quantités différentes) selon qu'ils partent "sur place" ou "à emporter" — d'où
// deux groupes de stock distincts par dessert, filtrés par `scope` dans
// remainingForDessertGroup. Le Paris Palerme est conditionné pareil dans les deux
// cas : un seul groupe (pas de `scope`) partagé par tous les services.
//
// `unlimited: true` — TEMPORAIRE, en attendant que la caisse soit reliée à l'app
// par API : l'équipe en salle n'a pas le temps de tenir le décompte à jour, donc
// le stock du jour de ces desserts n'est plus fiable. On force Panna Cotta et
// Tiramisu à rester disponibles et cliquables pour toutes les commandes à
// emporter (borne, click & collect /commande, commande équipe à emporter,
// formules panuzzo). Les Tiramisu "sur place" sont aussi passés en illimité
// (demande des équipes en service — même raison).
//
// `unlimitedStaffOnly: true` — même effet, mais UNIQUEMENT dans les flux
// serveuses (staffMode : prise de commande équipe, édition, programmées) ; la
// borne et le click & collect continuent de décompter normalement. Demandé pour
// Panna Cotta "sur place" et Paris Palerme (les serveuses connaissent le vrai
// stock, la borne non).
// À repasser sans ces indicateurs une fois l'API caisse en place.
export const DESSERT_STOCK_GROUPS = [
  { key: "pannacotta", label: "Panna Cotta (à emporter)", itemNames: ["Pana Cotta Framboise", "Pana Cotta Mangue"], scope: "takeaway", unlimited: true },
  { key: "pannacotta_sur_place", label: "Panna Cotta (sur place)", itemNames: ["Pana Cotta Framboise", "Pana Cotta Mangue"], scope: "dineIn", unlimitedStaffOnly: true },
  { key: "tiramisu_cafe", label: "Tiramisu Café (à emporter)", itemNames: ["Tiramisu Café"], scope: "takeaway", unlimited: true },
  { key: "tiramisu_cafe_sur_place", label: "Tiramisu Café (sur place)", itemNames: ["Tiramisu Café"], scope: "dineIn", unlimited: true },
  { key: "tiramisu_speculoos", label: "Tiramisu Spéculoos (à emporter)", itemNames: ["Tiramisu Spéculoos"], scope: "takeaway", unlimited: true },
  { key: "tiramisu_speculoos_sur_place", label: "Tiramisu Spéculoos (sur place)", itemNames: ["Tiramisu Spéculoos"], scope: "dineIn", unlimited: true },
  { key: "paris_palerme", label: "Paris Palerme", itemNames: ["Paris Palerme"], unlimitedStaffOnly: true },
];

// Note posée sur une ligne de panier quand une serveuse dépanne une commande
// sur place avec un dessert en format à emporter (stock sur place épuisé) —
// jamais l'inverse. Sert à la fois d'affichage (visible partout où les notes
// d'article s'affichent déjà) et de marqueur pour le décompte du stock (voir
// remainingForDessertGroup dans lib/business.js).
export const DESSERT_TAKEAWAY_FALLBACK_NOTE = "🥡 Format à emporter (stock sur place épuisé)";

// Icône affichée devant la note d'une ligne de panier — 💧 pour les sirops,
// rien pour le dépannage à emporter (déjà son propre emoji), 🍨 sinon.
export function noteIcon(name, note) {
  if (note === DESSERT_TAKEAWAY_FALLBACK_NOTE) return "";
  if (/sirop|diabolo/i.test(name || "")) return "💧";
  return "🍨";
}

// ---- Sous-catégories de produits (« options ») -------------------------------
// La source de vérité vit en base : menu_option_groups / menu_options /
// menu_item_option_groups (voir lib/data.js#useOptionGroups). N'importe quel
// produit peut porter une ou plusieurs sous-catégories, chacune avec sa liste
// d'options, son nombre de choix et son caractère obligatoire.
//
// Les listes ci-dessous ne servent QUE de repli tant que la migration
// menu_item_options n'a pas été jouée : un produit historiquement « à parfums »
// garde alors son sélecteur (1 groupe « Parfum », obligatoire).
export const GLACE_FLAVORS = ["Vanille", "Fior di latte", "Chocolat", "Stracciatella", "Cerise amarena", "Citron", "Noisette", "Pistache", "Fraise"];
export const SIROP_FLAVORS = ["Fraise", "Framboise", "Pêche", "Menthe", "Grenadine", "Vanille", "Citron", "Mojito", "Litchi", "Yuzu", "Caramel", "Fruit de la passion", "Basilic", "Orgeat"];

const LEGACY_FLAVOR_ITEMS = {
  "Glace 1 boule": { flavors: GLACE_FLAVORS, choices: 1 },
  "Glace 2 boules": { flavors: GLACE_FLAVORS, choices: 2 },
  "Glace 3 boules": { flavors: GLACE_FLAVORS, choices: 3 },
  "Sirop à l'eau": { flavors: SIROP_FLAVORS, choices: 1 },
  Diabolo: { flavors: SIROP_FLAVORS, choices: 1 },
};

// Groupe(s) d'options synthétique(s) déduits du seul nom du produit — utilisé
// par useOptionGroups en repli quand la base ne renvoie encore rien.
export function legacyOptionGroupsForItem(item) {
  const cfg = LEGACY_FLAVOR_ITEMS[item?.name];
  if (!cfg) return [];
  const gid = cfg.flavors === SIROP_FLAVORS ? "legacy-sirop" : "legacy-glace";
  return [
    {
      id: gid,
      name: "Parfum",
      choices: cfg.choices,
      required: true,
      sortOrder: 0,
      options: cfg.flavors.map((n, i) => ({ id: `${gid}:${n}`, name: n, sortOrder: i })),
    },
  ];
}

// Clé stockée dans `ruptures.item_id` pour une option indisponible.
export const optionRuptureKey = (groupId, optionName) => `opt:${groupId}:${optionName}`;
export function parseOptionRuptureKey(key) {
  const m = /^opt:([^:]+):(.+)$/.exec(key || "");
  return m ? { groupId: m[1], option: m[2] } : null;
}

export const eur = (n) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

let localUid = 0;
// Ids locaux uniquement (paniers, tables du plan de salle avant enregistrement) —
// jamais persistés tels quels : les commandes reçoivent leur id définitif de
// Postgres (gen_random_uuid()) à l'insertion.
export const nextLocalId = (p) => `${p}-${Date.now()}-${localUid++}`;
