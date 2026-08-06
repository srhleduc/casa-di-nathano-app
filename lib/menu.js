// Données statiques du menu — portées depuis borne-casa-di-nathano.jsx.
//
// Différence volontaire avec la source : les ids sont des slugs stables
// (ex. "pizza-margherita-di-napoli") au lieu d'ids générés à l'exécution
// (Date.now()+compteur). Dans l'artefact d'origine ça n'avait pas
// d'importance (une seule session ouverte), mais ici les ids sont
// stockés en base (ruptures, lignes de commande) et doivent rester
// identiques entre appareils et redémarrages.

export const CATEGORIES = [
  { key: "pizza", label: "Pizzas", emoji: "🍕" },
  { key: "antipasti", label: "Antipasti", emoji: "🥖" },
  { key: "salade", label: "Salades", emoji: "🥗" },
  { key: "boisson", label: "Boissons", emoji: "🥤" },
  { key: "biere", label: "Bières", emoji: "🍺" },
  { key: "vin", label: "Vins", emoji: "🍷" },
  { key: "cocktail", label: "Cocktails", emoji: "🍸" },
  { key: "dessert", label: "Desserts", emoji: "🍰" },
];

function slugify(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ---- MENU (nom + prix + catégorie) ----
const RAW_MENU = [
  // PIZZAS
  ["4 Formaggi", 13, "pizza"], ["Bouchère", 16.5, "pizza"], ["Calzone", 14, "pizza"],
  ["Calzone Piccante", 14, "pizza"], ["Carbonara", 16.5, "pizza"], ["Contadino", 15.8, "pizza"],
  ["Diavola", 14.7, "pizza"], ["Focaccia", 0, "pizza"], ["Margherita Di Napoli", 11.8, "pizza"],
  ["Margherita Semplice", 9.7, "pizza"], ["Marinara", 7.7, "pizza"], ["Mortadella", 16, "pizza"],
  ["Nathano", 15.3, "pizza"], ["Norvégienne", 15.7, "pizza"], ["Parma", 18, "pizza"],
  ["Parma Estiva", 16.5, "pizza"], ["Regina", 13.3, "pizza"], ["Regina Bambino", 12.3, "pizza"],
  ["Regina Parma", 14, "pizza"], ["Royale", 14.3, "pizza"], ["Spianata Piccante", 13.7, "pizza"],
  ["Végétarienne", 13.9, "pizza"],
  // ANTIPASTI
  ["Planche charcuterie", 8.5, "antipasti"], ["Planche fromage", 8.5, "antipasti"], ["Planche mixte (2 pers)", 16, "antipasti"],
  // SALADES
  ["Salade Parma (grande)", 14.3, "salade"], ["Salade Parma (petite)", 10.3, "salade"],
  ["Salade Végétarienne (grande)", 13.9, "salade"], ["Salade Végétarienne (petite)", 9.3, "salade"],
  ["Tomate Mozzarella (~310g)", 9.7, "salade"], ["Tomate Mozzarella (~500g)", 14.7, "salade"],
  // SUPPLÉMENTS
  ["Supp. Ail", 2, "supplement"], ["Supp. Basilic", 2, "supplement"], ["Supp. Champignons", 2, "supplement"],
  ["Supp. Chèvre", 2, "supplement"], ["Supp. Copeaux de parmesan", 2, "supplement"], ["Supp. Courgettes", 2, "supplement"],
  ["Supp. Crème", 1, "supplement"], ["Supp. Crème de balsamique", 2, "supplement"], ["Supp. Crème de pistache", 2, "supplement"],
  ["Supp. Fior di latte", 2, "supplement"], ["Supp. Fleurs alpines", 2, "supplement"], ["Supp. Gorgonzola", 2, "supplement"],
  ["Supp. Graine de fenouil", 2, "supplement"], ["Supp. Guanciale", 2, "supplement"], ["Supp. Huile de basilic", 2, "supplement"],
  ["Supp. Huile de gingembre", 2, "supplement"], ["Supp. Huile de mandarine", 2, "supplement"], ["Supp. Huile piquante", 2, "supplement"],
  ["Supp. Jambon blanc", 2, "supplement"], ["Supp. Jambon de Parme", 2, "supplement"], ["Supp. Jaune d'oeuf", 2, "supplement"],
  ["Supp. Lard fumé", 2, "supplement"], ["Supp. Merguez", 2, "supplement"], ["Supp. Miel", 2, "supplement"],
  ["Supp. Mortadella", 2, "supplement"], ["Supp. Nduja", 2, "supplement"], ["Supp. Noix", 2, "supplement"],
  ["Supp. Oeuf", 2, "supplement"], ["Supp. Oignons frits", 2, "supplement"], ["Supp. Olives", 2, "supplement"],
  ["Supp. Origan", 2, "supplement"], ["Supp. Parmesan", 2, "supplement"], ["Supp. Pickles oignons rouges", 2, "supplement"],
  ["Supp. Piment", 2, "supplement"], ["Supp. Poivre de sichuan", 2, "supplement"], ["Supp. Pommes de terre", 2, "supplement"],
  ["Supp. Roquette", 2, "supplement"], ["Supp. Saumon", 2, "supplement"], ["Supp. Scarmorza fumée", 2, "supplement"],
  ["Supp. Spianata piccante", 2, "supplement"], ["Supp. Stracciatella", 2, "supplement"], ["Supp. Taleggio", 2, "supplement"],
  ["Supp. Thym", 2, "supplement"], ["Supp. Tomate", 1, "supplement"], ["Supp. Tomates cerises", 2, "supplement"],
  ["Supp. Viande hachée", 2, "supplement"], ["Supp. Zeste de citron vert", 2, "supplement"], ["Supp. Éclats de pistaches", 2, "supplement"],
  ["Supplément (base)", 2, "supplement"], ["Supplément Ananas", 2.5, "supplement"], ["Supplément Anchois", 5, "supplement"],
  ["Supplément Cœur de Burrata", 3.9, "supplement"], ["Supplément Mozzarella di Buffala", 3.9, "supplement"], ["Supplément Salade", 3.6, "supplement"],
  // SANS
  ["Sans Ail", 0, "sans"], ["Sans Basilic", 0, "sans"], ["Sans Champignons", 0, "sans"], ["Sans Chèvre", 0, "sans"],
  ["Sans Copeaux de parmesan", 0, "sans"], ["Sans Courgettes", 0, "sans"], ["Sans Crème", 0, "sans"],
  ["Sans Crème de balsamique", 0, "sans"], ["Sans Crème de pistache", 0, "sans"], ["Sans Fior di latte", 0, "sans"],
  ["Sans Fleurs alpines", 0, "sans"], ["Sans Gorgonzola", 0, "sans"], ["Sans Graine de fenouil", 0, "sans"],
  ["Sans Guanciale", 0, "sans"], ["Sans Huile de basilic", 0, "sans"], ["Sans Huile de gingembre", 0, "sans"],
  ["Sans Huile de mandarine", 0, "sans"], ["Sans Huile piquante", 0, "sans"], ["Sans Jambon blanc", 0, "sans"],
  ["Sans Jambon de Parme", 0, "sans"], ["Sans Jaune d'oeuf", 0, "sans"], ["Sans Lard fumé", 0, "sans"],
  ["Sans Merguez", 0, "sans"], ["Sans Miel", 0, "sans"], ["Sans Mortadella", 0, "sans"], ["Sans Nduja", 0, "sans"],
  ["Sans Noix", 0, "sans"], ["Sans Oeuf", 0, "sans"], ["Sans Oignons frits", 0, "sans"], ["Sans Olives", 0, "sans"],
  ["Sans Origan", 0, "sans"], ["Sans Parmesan", 0, "sans"], ["Sans Pickles oignons rouges", 0, "sans"],
  ["Sans Piment", 0, "sans"], ["Sans Poivre de sichuan", 0, "sans"], ["Sans Pommes de terre", 0, "sans"],
  ["Sans Roquette", 0, "sans"], ["Sans Saumon", 0, "sans"], ["Sans Scarmorza fumée", 0, "sans"],
  ["Sans Spianata piccante", 0, "sans"], ["Sans Stracciatella", 0, "sans"], ["Sans Taleggio", 0, "sans"],
  ["Sans Thym", 0, "sans"], ["Sans Tomate", 0, "sans"], ["Sans Tomates cerises", 0, "sans"],
  ["Sans Viande hachée", 0, "sans"], ["Sans Zeste de citron vert", 0, "sans"], ["Sans Éclats de pistaches", 0, "sans"],
  // BOISSONS
  ["Arranciata", 5, "boisson"], ["Carafe d'eau", 0, "boisson"], ["Cedrata", 5, "boisson"], ["Chinioto", 5, "boisson"],
  ["Coca", 3.5, "boisson"], ["Coca Cherry", 3.5, "boisson"], ["Coca Zero", 3.5, "boisson"], ["Cola artisanale", 5, "boisson"],
  ["Cristaline Gazeuse", 2.5, "boisson"], ["Diabolo", 3.7, "boisson"], ["Evian 1L", 4.7, "boisson"], ["Evian 50cl", 2.9, "boisson"],
  ["Gazosa (limonade)", 5, "boisson"], ["Ice Tea", 3.5, "boisson"], ["Jus d'abricot", 4.3, "boisson"], ["Jus d'ananas", 3.7, "boisson"],
  ["Jus de pomme", 3.7, "boisson"], ["Jus de tomate", 4.3, "boisson"], ["Lemone e Zenzero", 4.2, "boisson"], ["Mandarino", 4.2, "boisson"],
  ["Oasis / Tropico", 3.5, "boisson"], ["Pago", 3.7, "boisson"], ["San Pellegrino 1L", 4.7, "boisson"], ["San Pellegrino 50cl", 2.9, "boisson"],
  ["Sirop à l'eau", 2.7, "boisson"], ["Sprite", 3.5, "boisson"], ["Thé citron Sicile", 4.3, "boisson"], ["Thé pêche Sicile", 4.3, "boisson"],
  // BIÈRES
  ["Birra Moretti 25cl", 4.2, "biere"], ["Birra Moretti 50cl", 7.9, "biere"], ["Bélon", 5.7, "biere"], ["Dourdu", 5.7, "biere"],
  ["IPA", 6.5, "biere"], ["Isaac", 6.5, "biere"], ["Nazionale", 6.5, "biere"], ["Nora", 6.5, "biere"],
  ["Rock'n'Roll", 6.5, "biere"], ["Wayan", 6.5, "biere"], ["Écume", 5.7, "biere"],
  // VINS
  ["Bardolino Classico (bouteille)", 29, "vin"], ["Bardolino Villa Borghetti (bouteille)", 17.5, "vin"],
  ["Bardolino Villa Borghetti (verre)", 4.9, "vin"], ["Bonorli Toscana (bouteille)", 21.5, "vin"],
  ["Coribante Syrah (bouteille)", 27.5, "vin"], ["Grillo Sicilia (bouteille)", 22, "vin"], ["Grillo Sicilia (verre)", 5.9, "vin"],
  ["Il Gambero (bouteille)", 19, "vin"], ["Il Gambero (verre)", 5, "vin"], ["Lambrusco (bouteille)", 18, "vin"],
  ["Monte Pietroso (bouteille)", 16.8, "vin"], ["Monte Pietroso (verre)", 4.6, "vin"], ["Montepulciano (bouteille)", 29, "vin"],
  ["Nero d'Avola (bouteille)", 27.5, "vin"], ["Nero d'Avola (verre)", 6.2, "vin"], ["Prosecco Bolla (bouteille)", 25.5, "vin"],
  ["Prosecco Bolla (verre)", 6.2, "vin"], ["Prosecco Rosé (bouteille)", 27, "vin"], ["Simera Chardonnay (bouteille)", 27, "vin"],
  ["Tanti Petali (bouteille)", 22.5, "vin"], ["Vaja Pinot Grigio (bouteille)", 18, "vin"], ["Vaja Pinot Grigio (verre)", 5, "vin"],
  // COCKTAILS
  ["Classique Spritz", 9.5, "cocktail"], ["Framboise Ginger", 6.5, "cocktail"], ["Lime Mint", 6.5, "cocktail"],
  ["Limon Spritz", 10.5, "cocktail"], ["Pom'Spritz", 10.5, "cocktail"], ["Virgin Mojito", 6.5, "cocktail"],
  // DESSERTS
  ["Gelato dello chef", 4.9, "dessert"], ["Glace 1 boule", 2.8, "dessert"], ["Glace 2 boules", 5.2, "dessert"],
  ["Glace 3 boules", 7, "dessert"], ["Pana Cotta Framboise", 5.9, "dessert"], ["Pana Cotta Mangue", 5.9, "dessert"],
  ["Paris Palerme", 8.5, "dessert"], ["Tiramisu Café", 6.3, "dessert"], ["Tiramisu Spéculoos", 6.3, "dessert"],
];

export const MENU = RAW_MENU.map(([name, price, cat]) => ({
  id: `${cat}-${slugify(name)}`,
  name,
  price,
  cat,
}));

// Liste des ingrédients disponibles pour construire la recette d'une nouvelle pizza
export const INGREDIENT_NAMES = MENU.filter((m) => m.cat === "sans")
  .map((m) => m.name.replace("Sans ", ""))
  .sort();

// Stock du jour pour certains desserts — le coulis étant ajouté indépendamment,
// les deux Pana Cotta partagent un même stock ; les Tiramisu sont comptés séparément.
export const DESSERT_STOCK_GROUPS = [
  { key: "pannacotta", label: "Panna Cotta", itemNames: ["Pana Cotta Framboise", "Pana Cotta Mangue"] },
  { key: "tiramisu_cafe", label: "Tiramisu Café", itemNames: ["Tiramisu Café"] },
  { key: "tiramisu_speculoos", label: "Tiramisu Spéculoos", itemNames: ["Tiramisu Spéculoos"] },
  { key: "paris_palerme", label: "Paris Palerme", itemNames: ["Paris Palerme"] },
];

// Composition des pizzas — sert à proposer "retirer un ingrédient" pertinent pour chacune
export const PIZZA_RECIPES = {
  "4 Formaggi": ["Fior di latte", "Gorgonzola", "Chèvre", "Parmesan"],
  "Bouchère": ["Fior di latte", "Viande hachée", "Merguez", "Tomates cerises", "Pickles oignons rouges", "Basilic", "Zeste de citron vert"],
  "Calzone": ["Champignons", "Fior di latte", "Crème", "Jambon blanc", "Oeuf"],
  "Calzone Piccante": ["Champignons", "Fior di latte", "Crème", "Spianata piccante", "Oeuf"],
  "Carbonara": ["Fior di latte", "Guanciale", "Jaune d'oeuf", "Parmesan", "Basilic", "Oignons frits"],
  "Contadino": ["Fior di latte", "Pommes de terre", "Lard fumé", "Taleggio", "Pickles oignons rouges", "Oignons frits"],
  "Diavola": ["Spianata piccante", "Nduja", "Basilic", "Fior di latte", "Piment"],
  "Margherita Di Napoli": ["Fior di latte", "Basilic", "Parmesan"],
  "Margherita Semplice": ["Fior di latte", "Basilic"],
  "Marinara": ["Ail", "Origan"],
  "Mortadella": ["Crème de pistache", "Fior di latte", "Mortadella", "Stracciatella", "Éclats de pistaches", "Huile de basilic"],
  "Nathano": ["Crème", "Spianata piccante", "Fior di latte", "Scarmorza fumée", "Basilic", "Poivre de sichuan", "Huile de gingembre", "Fleurs alpines", "Graine de fenouil", "Pickles oignons rouges"],
  "Norvégienne": ["Saumon", "Pickles oignons rouges", "Thym", "Huile de mandarine", "Fior di latte"],
  "Parma": ["Roquette", "Copeaux de parmesan", "Jambon de Parme"],
  "Parma Estiva": ["Fior di latte", "Basilic", "Tomates cerises", "Jambon de Parme"],
  "Regina": ["Champignons", "Fior di latte", "Jambon blanc", "Olives"],
  "Regina Bambino": ["Fior di latte", "Jambon blanc", "Olives"],
  "Regina Parma": ["Champignons", "Fior di latte", "Jambon de Parme", "Olives"],
  "Royale": ["Champignons", "Fior di latte", "Jambon blanc", "Olives", "Oeuf"],
  "Spianata Piccante": ["Crème", "Fior di latte", "Spianata piccante", "Chèvre", "Miel", "Noix", "Piment"],
  "Végétarienne": ["Fior di latte", "Basilic", "Courgettes", "Parmesan", "Stracciatella"],
};

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
// jamais persistés tels quels : les commandes/produits reçoivent leur id définitif
// de Postgres (gen_random_uuid()) à l'insertion.
export const nextLocalId = (p) => `${p}-${Date.now()}-${localUid++}`;
