// Tests de la logique des catégories de menu. Lancer : node lib/menuCategories.test.mjs
import { buildCategoryList, uniqueCategoryKey, isBuiltinCategory } from "./menuCategories.js";
import { orderedCategories, CATEGORIES } from "./menu.js";

let passed = 0;
let failed = 0;
function ok(cond, name) {
  if (cond) passed++;
  else {
    failed++;
    console.error("  ✗ " + name);
  }
}

// Table vide ou absente : les 10 catégories d'origine, toutes actives
const fallback = buildCategoryList([]);
ok(fallback.length === CATEGORIES.length, "repli : 10 catégories d'origine");
ok(fallback.every((c) => c.active && c.builtin), "repli : toutes actives et d'origine");
ok(buildCategoryList(undefined).length === CATEGORIES.length, "repli : valeur absente");
ok(fallback.map((c) => c.key).join() === CATEGORIES.map((c) => c.key).join(), "repli : ordre naturel");

// Désactivation + catégorie créée
const rows = [
  { key: "pizza", label: "Pizzas", emoji: "🍕", active: true, sortOrder: 0 },
  { key: "salade", label: "Salades", emoji: "🥗", active: false, sortOrder: 1 },
  { key: "noel", label: "Noël", emoji: "🎄", active: true, sortOrder: 2 },
];
const list = buildCategoryList(rows);
ok(list.find((c) => c.key === "salade").active === false, "salade désactivée");
ok(list.find((c) => c.key === "noel").builtin === false, "Noël n'est pas d'origine");
ok(list.find((c) => c.key === "noel").emoji === "🎄", "emoji conservé");
ok(list.slice(0, 3).map((c) => c.key).join() === "pizza,salade,noel", "ordre de la base respecté");
ok(CATEGORIES.every((c) => list.some((l) => l.key === c.key)), "aucune catégorie d'origine perdue");
ok(list.find((c) => c.key === "dessert").active === true, "catégorie d'origine absente de la base : active");
ok(list.length === CATEGORIES.length + 1, "10 d'origine + 1 créée");
ok(buildCategoryList([{ key: "noel", label: "Noël", sortOrder: 0 }, { key: "noel", label: "Doublon", sortOrder: 1 }]).filter((c) => c.key === "noel").length === 1, "doublon ignoré");
ok(buildCategoryList([{ key: "noel", label: "Noël", sortOrder: 0 }])[0].emoji === "🏷️", "emoji par défaut");

// Clés
ok(isBuiltinCategory("pizza") && !isBuiltinCategory("noel"), "catégorie d'origine reconnue");
ok(uniqueCategoryKey("Noël", []) === "noel", "clé simple");
ok(uniqueCategoryKey("Menu Enfant", []) === "menu-enfant", "clé avec espace");
ok(uniqueCategoryKey("Noël", ["noel"]) === "noel-2", "clé déjà prise");
ok(uniqueCategoryKey("Noël", ["noel", "noel-2"]) === "noel-3", "clé déjà prise deux fois");
ok(uniqueCategoryKey("Pizza", ["pizza"]) === "pizza-2", "ne reprend pas une clé d'origine");
ok(uniqueCategoryKey("Sans", []) === "sans-2", "clé réservée évitée");
ok(uniqueCategoryKey("🎄", []) === "categorie", "nom sans lettres : clé générique");

// orderedCategories avec une liste personnalisée
const custom = [
  { key: "pizza", label: "Pizzas", emoji: "🍕" },
  { key: "noel", label: "Noël", emoji: "🎄" },
  { key: "dessert", label: "Desserts", emoji: "🍰" },
];
ok(orderedCategories([], custom).map((c) => c.key).join() === "pizza,noel,dessert", "ordre naturel de la liste");
ok(orderedCategories(["dessert", "pizza"], custom).map((c) => c.key).join() === "dessert,pizza,noel", "ordre enregistré puis reste");
ok(orderedCategories(["salade", "pizza"], custom).map((c) => c.key).join() === "pizza,noel,dessert", "clé inconnue/désactivée ignorée");
ok(orderedCategories(["pizza"]).length === CATEGORIES.length, "sans liste : catégories d'origine");

if (failed > 0) {
  console.error(`menuCategories: ${failed} échec(s), ${passed} ok`);
  process.exit(1);
}
console.log(`menuCategories: ${passed} tests ok`);
