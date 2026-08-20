// Peuple appro_recipes/appro_recipe_ingredients pour les 23 pizzas/panuzzo
// à partir des recettes extraites du Canva de référence (voir conversation
// du 2026-08-20). Idempotent : relançable sans dupliquer (upsert par nom de
// produit / par recette+produit).
//
// Contexte des choix de conversion d'unité :
// - Grammage donné (parenthèses ou "Xg"/"X-Yg" nu) -> unité "g", valeur
//   médiane si fourchette.
// - Pas de grammage -> unité cuisine telle quelle (tranche, feuille,
//   gousse, pincée, cuillère, moulinet, bâtonnet, filet, pièce) avec la
//   quantité donnée.
// - Plusieurs produits existants étaient enregistrés en unité "pièce"
//   (= 1 bouteille/pot/pièce achetée) alors que la recette en consomme une
//   fraction (huiles, crèmes, fromages à la coupe...) -- on a converti leur
//   unité vers g/tranche/etc. pour que la recette soit lisible (stock à 0
//   partout à ce moment-là, donc conversion sans perte de données).
// - Tomate (sauce de base) : produit existant "Tomates Pélées S. Marzano
//   3/1" (Danioli), renommé en unité "boîte", ratio fixe 0,02 boîte/pizza
//   (≈ 1 boîte pour 50 pizzas, donnée par Nathan) pour toutes les pizzas
//   rouges -- pas le grammage donné au cas par cas dans le Canva.
// - Pâte, Crème poireaux, Crème spianata, Crème pistache : laissés hors
//   suivi de stock (préparations maison), aucune ligne de recette créée.
// - Ingrédients non quantifiés dans le Canva (Graines fenouil "parsemer la
//   pizza", Zestes citron vert "non quantifié", "Noix" du Spianata) : omis,
//   impossible de créer une ligne sans quantité.
// - Parma (sur place) et Parma (emporter) du Canva sont fusionnées en une
//   seule recette (même ingrédients, seule la présentation à emporter
//   change) car un seul article menu "Parma" existe.
//
// Usage : APPRO_SEED_EMAIL=... APPRO_SEED_PASSWORD=... node scripts/seed-pizza-recipes.mjs

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envLocal = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
const url = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const anonKey = envLocal.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const supabase = createClient(url, anonKey);

const email = process.env.APPRO_SEED_EMAIL;
const password = process.env.APPRO_SEED_PASSWORD;
if (!email || !password) {
  console.error("Définis APPRO_SEED_EMAIL et APPRO_SEED_PASSWORD (compte de service) avant de lancer ce script.");
  process.exit(1);
}
const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
if (authErr) { console.error("AUTH ERROR", authErr); process.exit(1); }

const NEW_PRODUCTS = [
  { name: "Ail", unit: "gousse" },
  { name: "Origan", unit: "g" },
  { name: "Basilic frais", unit: "feuille" },
  { name: "Champignons", unit: "g" },
  { name: "Oeuf", unit: "pièce" },
  { name: "Oignons pickles (vinaigre de cidre, maison)", unit: "g" },
  { name: "Pommes de terre", unit: "g" },
  { name: "Oignons frits", unit: "pincée" },
  { name: "Pétales de fleurs comestibles", unit: "pincée" },
  { name: "Huile Olive/Citron (Coppini)", unit: "g" },
  { name: "Tomates séchées", unit: "pièce" },
  { name: "Merguez", unit: "g" },
  { name: "Tomates cerises", unit: "pièce" },
  { name: "Courgettes", unit: "tranche" },
  { name: "Thym", unit: "g" },
];

const UNIT_UPDATES = [
  { name: "Tomates Pélées S. Marzano 3/1", unit: "boîte" },
  { name: "Huile d'Olive extra vierge Materia Prima 5 Litres (Coppini)", unit: "g" },
  { name: "Parmigiano Reggiano Pointe 12mois env1kg s/v", unit: "g" },
  { name: "Mozzarella Fior d'Italia Julienne VALCOLATTE", unit: "g" },
  { name: "Jambon porc cuit rôti aux herbes 1/2 pièce (Rovagnati)", unit: "g" },
  { name: "Jambon de Parme AOP Mattonella (Villani)", unit: "tranche" },
  { name: "Crème fraîche épaisse 30% seau 5 Litres (Graindorge)", unit: "cuillère" },
  { name: "Spianata Calabra entier (GSI)", unit: "tranche" },
  { name: "Saumon fumé pré-tranché sans peau (600/900g)", unit: "g" },
  { name: "Huile Olive/Mandarine 250ml (Coppini)", unit: "g" },
  { name: "Taleggio DOP", unit: "bâtonnet" },
  { name: "Scamorza fumé 1kg", unit: "tranche" },
  { name: "Poivre du Sichuan en grains 470 ml", unit: "moulinet" },
  { name: "Huile Olive/Zenzero(gingembre) 250ml (Coppini)", unit: "g" },
  { name: "Miel de fleur gastronomie en squeeze 740g Lune de Miel", unit: "g" },
  { name: "Mortadelle IGP Massima (Rovagnati)", unit: "tranche" },
  { name: "Granella di pistacchi (pistache concassée) 500grs", unit: "g" },
  { name: "Huile Olive/Basilic 250ml (Coppini)", unit: "g" },
  { name: "Salade jeunes pousses roquette sauvage barquette 250g", unit: "g" },
  { name: "Crème Balsamique 500 ml", unit: "g" },
  { name: "Gorgonzola 1/8", unit: "g" },
  { name: "Chèvre bûche 1 kg", unit: "g" },
  { name: "Crème UHT 20 % TB 1 Litre (Frischli)", unit: "cuillère" },
  { name: "Nduja 200 grs s/v", unit: "g" },
  { name: "Huile Olive/Peperoncino rosso 250ml (Coppini)", unit: "g" },
  { name: "Filaments piment fort 470 ml (Wiberg)", unit: "pincée" },
  { name: "Guanciale Toscano (Rovagnati)", unit: "g" },
];

const TOMATE = "Tomates Pélées S. Marzano 3/1";
const RECIPES = [
  { menuItemId: "pizza-marinara", ingredients: [
    { productName: TOMATE, quantityPerUnit: 0.02, unit: "boîte" },
    { productName: "Ail", quantityPerUnit: 1, unit: "gousse" },
    { productName: "Origan", quantityPerUnit: 1, unit: "g" },
    { productName: "Huile d'Olive extra vierge Materia Prima 5 Litres (Coppini)", quantityPerUnit: 3, unit: "g" },
  ]},
  { menuItemId: "pizza-margherita-di-napoli", ingredients: [
    { productName: TOMATE, quantityPerUnit: 0.02, unit: "boîte" },
    { productName: "Mozzarella Di Bufala Campana 125 grs", quantityPerUnit: 1, unit: "pièce" },
    { productName: "Basilic frais", quantityPerUnit: 5, unit: "feuille" },
    { productName: "Parmigiano Reggiano Pointe 12mois env1kg s/v", quantityPerUnit: 6, unit: "g" },
    { productName: "Huile d'Olive extra vierge Materia Prima 5 Litres (Coppini)", quantityPerUnit: 3, unit: "g" },
  ]},
  { menuItemId: "pizza-margherita-semplice", ingredients: [
    { productName: TOMATE, quantityPerUnit: 0.02, unit: "boîte" },
    { productName: "Mozzarella Fior d'Italia Julienne VALCOLATTE", quantityPerUnit: 60, unit: "g" },
    { productName: "Basilic frais", quantityPerUnit: 5, unit: "feuille" },
    { productName: "Huile d'Olive extra vierge Materia Prima 5 Litres (Coppini)", quantityPerUnit: 3, unit: "g" },
  ]},
  { menuItemId: "pizza-regina", ingredients: [
    { productName: TOMATE, quantityPerUnit: 0.02, unit: "boîte" },
    { productName: "Jambon porc cuit rôti aux herbes 1/2 pièce (Rovagnati)", quantityPerUnit: 40, unit: "g" },
    { productName: "Mozzarella Fior d'Italia Julienne VALCOLATTE", quantityPerUnit: 75, unit: "g" },
    { productName: "Champignons", quantityPerUnit: 60, unit: "g" },
    { productName: "Olives Kalamata marinées verre 1600 ml Demetra", quantityPerUnit: 5, unit: "pièce" },
  ]},
  { menuItemId: "pizza-regina-parma", ingredients: [
    { productName: TOMATE, quantityPerUnit: 0.02, unit: "boîte" },
    { productName: "Mozzarella Fior d'Italia Julienne VALCOLATTE", quantityPerUnit: 75, unit: "g" },
    { productName: "Champignons", quantityPerUnit: 60, unit: "g" },
    { productName: "Jambon de Parme AOP Mattonella (Villani)", quantityPerUnit: 5, unit: "tranche" },
    { productName: "Olives Kalamata marinées verre 1600 ml Demetra", quantityPerUnit: 5, unit: "pièce" },
  ]},
  { menuItemId: "pizza-regina-bambino", ingredients: [
    { productName: TOMATE, quantityPerUnit: 0.02, unit: "boîte" },
    { productName: "Jambon porc cuit rôti aux herbes 1/2 pièce (Rovagnati)", quantityPerUnit: 40, unit: "g" },
    { productName: "Mozzarella Fior d'Italia Julienne VALCOLATTE", quantityPerUnit: 75, unit: "g" },
    { productName: "Olives Kalamata marinées verre 1600 ml Demetra", quantityPerUnit: 5, unit: "pièce" },
  ]},
  { menuItemId: "pizza-royale", ingredients: [
    { productName: TOMATE, quantityPerUnit: 0.02, unit: "boîte" },
    { productName: "Jambon porc cuit rôti aux herbes 1/2 pièce (Rovagnati)", quantityPerUnit: 40, unit: "g" },
    { productName: "Mozzarella Fior d'Italia Julienne VALCOLATTE", quantityPerUnit: 75, unit: "g" },
    { productName: "Champignons", quantityPerUnit: 60, unit: "g" },
    { productName: "Olives Kalamata marinées verre 1600 ml Demetra", quantityPerUnit: 5, unit: "pièce" },
    { productName: "Oeuf", quantityPerUnit: 1, unit: "pièce" },
  ]},
  { menuItemId: "pizza-calzone", ingredients: [
    { productName: TOMATE, quantityPerUnit: 0.02, unit: "boîte" },
    { productName: "Mozzarella Fior d'Italia Julienne VALCOLATTE", quantityPerUnit: 60, unit: "g" },
    { productName: "Jambon porc cuit rôti aux herbes 1/2 pièce (Rovagnati)", quantityPerUnit: 40, unit: "g" },
    { productName: "Champignons", quantityPerUnit: 40, unit: "g" },
    { productName: "Crème fraîche épaisse 30% seau 5 Litres (Graindorge)", quantityPerUnit: 0.5, unit: "cuillère" },
    { productName: "Oeuf", quantityPerUnit: 1, unit: "pièce" },
  ]},
  { menuItemId: "pizza-calzone-piccante", ingredients: [
    { productName: TOMATE, quantityPerUnit: 0.02, unit: "boîte" },
    { productName: "Mozzarella Fior d'Italia Julienne VALCOLATTE", quantityPerUnit: 60, unit: "g" },
    { productName: "Spianata Calabra entier (GSI)", quantityPerUnit: 4, unit: "tranche" },
    { productName: "Champignons", quantityPerUnit: 40, unit: "g" },
    { productName: "Crème fraîche épaisse 30% seau 5 Litres (Graindorge)", quantityPerUnit: 0.5, unit: "cuillère" },
    { productName: "Oeuf", quantityPerUnit: 1, unit: "pièce" },
  ]},
  { menuItemId: "pizza-norvegienne", ingredients: [
    { productName: "Mozzarella Fior d'Italia Julienne VALCOLATTE", quantityPerUnit: 70, unit: "g" },
    { productName: "Oignons pickles (vinaigre de cidre, maison)", quantityPerUnit: 10, unit: "g" },
    { productName: "Saumon fumé pré-tranché sans peau (600/900g)", quantityPerUnit: 50, unit: "g" },
    { productName: "Thym", quantityPerUnit: 1, unit: "g" },
    { productName: "Huile Olive/Mandarine 250ml (Coppini)", quantityPerUnit: 2, unit: "g" },
  ]},
  { menuItemId: "pizza-contadino", ingredients: [
    { productName: "Mozzarella Fior d'Italia Julienne VALCOLATTE", quantityPerUnit: 70, unit: "g" },
    { productName: "Poitrine fumée", quantityPerUnit: 0.09, unit: "kg" },
    { productName: "Pommes de terre", quantityPerUnit: 60, unit: "g" },
    { productName: "Taleggio DOP", quantityPerUnit: 5, unit: "bâtonnet" },
    { productName: "Oignons frits", quantityPerUnit: 1, unit: "pincée" },
  ]},
  { menuItemId: "pizza-nathano", ingredients: [
    { productName: "Spianata Calabra entier (GSI)", quantityPerUnit: 5, unit: "tranche" },
    { productName: "Scamorza fumé 1kg", quantityPerUnit: 5, unit: "tranche" },
    { productName: "Mozzarella Fior d'Italia Julienne VALCOLATTE", quantityPerUnit: 70, unit: "g" },
    { productName: "Oignons pickles (vinaigre de cidre, maison)", quantityPerUnit: 10, unit: "g" },
    { productName: "Poivre du Sichuan en grains 470 ml", quantityPerUnit: 2, unit: "moulinet" },
    { productName: "Pétales de fleurs comestibles", quantityPerUnit: 1, unit: "pincée" },
    { productName: "Basilic frais", quantityPerUnit: 5, unit: "feuille" },
    { productName: "Huile Olive/Zenzero(gingembre) 250ml (Coppini)", quantityPerUnit: 2, unit: "g" },
  ]},
  { menuItemId: "pizza-spianata-piccante", ingredients: [
    { productName: "Crème UHT 20 % TB 1 Litre (Frischli)", quantityPerUnit: 1, unit: "cuillère" },
    { productName: "Spianata Calabra entier (GSI)", quantityPerUnit: 5, unit: "tranche" },
    { productName: "Mozzarella Fior d'Italia Julienne VALCOLATTE", quantityPerUnit: 70, unit: "g" },
    { productName: "Chèvre bûche 1 kg", quantityPerUnit: 35, unit: "g" },
    { productName: "Filaments piment fort 470 ml (Wiberg)", quantityPerUnit: 1, unit: "pincée" },
    { productName: "Miel de fleur gastronomie en squeeze 740g Lune de Miel", quantityPerUnit: 3, unit: "g" },
  ]},
  { menuItemId: "pizza-mortadella", ingredients: [
    { productName: "Mozzarella Fior d'Italia Julienne VALCOLATTE", quantityPerUnit: 70, unit: "g" },
    { productName: "Mortadelle IGP Massima (Rovagnati)", quantityPerUnit: 5, unit: "tranche" },
    { productName: "Stracciatella 300grs (cartons de 8 pièces)", quantityPerUnit: 0.25, unit: "pièce" },
    { productName: "Granella di pistacchi (pistache concassée) 500grs", quantityPerUnit: 7, unit: "g" },
    { productName: "Huile Olive/Basilic 250ml (Coppini)", quantityPerUnit: 2, unit: "g" },
  ]},
  { menuItemId: "pizza-parma", ingredients: [
    { productName: TOMATE, quantityPerUnit: 0.02, unit: "boîte" },
    { productName: "Mozzarella Di Bufala Campana 125 grs", quantityPerUnit: 1, unit: "pièce" },
    { productName: "Salade jeunes pousses roquette sauvage barquette 250g", quantityPerUnit: 25, unit: "g" },
    { productName: "Jambon de Parme AOP Mattonella (Villani)", quantityPerUnit: 5, unit: "tranche" },
    { productName: "Crème Balsamique 500 ml", quantityPerUnit: 5, unit: "g" },
    { productName: "Parmigiano Reggiano Pointe 12mois env1kg s/v", quantityPerUnit: 10, unit: "g" },
  ]},
  { menuItemId: "pizza-4-formaggi", ingredients: [
    { productName: "Mozzarella Fior d'Italia Julienne VALCOLATTE", quantityPerUnit: 70, unit: "g" },
    { productName: "Gorgonzola 1/8", quantityPerUnit: 35, unit: "g" },
    { productName: "Chèvre bûche 1 kg", quantityPerUnit: 35, unit: "g" },
    { productName: "Parmigiano Reggiano Pointe 12mois env1kg s/v", quantityPerUnit: 7, unit: "g" },
  ]},
  { menuItemId: "panuzzo-poisson", ingredients: [
    { productName: "Salade jeunes pousses roquette sauvage barquette 250g", quantityPerUnit: 40, unit: "g" },
    { productName: "Stracciatella 300grs (cartons de 8 pièces)", quantityPerUnit: 0.2, unit: "pièce" },
    { productName: "Saumon fumé pré-tranché sans peau (600/900g)", quantityPerUnit: 30, unit: "g" },
    { productName: "Huile Olive/Citron (Coppini)", quantityPerUnit: 3, unit: "g" },
  ]},
  { menuItemId: "panuzzo-vegetarien", ingredients: [
    { productName: "Salade jeunes pousses roquette sauvage barquette 250g", quantityPerUnit: 40, unit: "g" },
    { productName: "Stracciatella 300grs (cartons de 8 pièces)", quantityPerUnit: 0.2, unit: "pièce" },
    { productName: "Tomates séchées", quantityPerUnit: 10, unit: "pièce" },
    { productName: "Parmigiano Reggiano Pointe 12mois env1kg s/v", quantityPerUnit: 8, unit: "g" },
    { productName: "Oignons pickles (vinaigre de cidre, maison)", quantityPerUnit: 10, unit: "g" },
    { productName: "Gouttes de Poivrons Jaune aigre-doux 4/4 (Demetra)", quantityPerUnit: 5, unit: "pièce" },
    { productName: "Gouttes de Poivrons rouge aigre doux 4/4 Demetra", quantityPerUnit: 5, unit: "pièce" },
  ]},
  { menuItemId: "panuzzo-viande", ingredients: [
    { productName: "Salade jeunes pousses roquette sauvage barquette 250g", quantityPerUnit: 40, unit: "g" },
    { productName: "Stracciatella 300grs (cartons de 8 pièces)", quantityPerUnit: 0.2, unit: "pièce" },
    { productName: "Mortadelle IGP Massima (Rovagnati)", quantityPerUnit: 3, unit: "tranche" },
    { productName: "Parmigiano Reggiano Pointe 12mois env1kg s/v", quantityPerUnit: 8, unit: "g" },
  ]},
  { menuItemId: "pizza-bouchere", ingredients: [
    { productName: "Mozzarella Fior d'Italia Julienne VALCOLATTE", quantityPerUnit: 90, unit: "g" },
    { productName: "Bœuf haché", quantityPerUnit: 0.05, unit: "kg" },
    { productName: "Merguez", quantityPerUnit: 50, unit: "g" },
    { productName: "Tomates cerises", quantityPerUnit: 6, unit: "pièce" },
    { productName: "Oignons pickles (vinaigre de cidre, maison)", quantityPerUnit: 10, unit: "g" },
    { productName: "Basilic frais", quantityPerUnit: 5, unit: "feuille" },
  ]},
  { menuItemId: "pizza-diavola", ingredients: [
    { productName: TOMATE, quantityPerUnit: 0.02, unit: "boîte" },
    { productName: "Mozzarella Fior d'Italia Julienne VALCOLATTE", quantityPerUnit: 70, unit: "g" },
    { productName: "Spianata Calabra entier (GSI)", quantityPerUnit: 5, unit: "tranche" },
    { productName: "Nduja 200 grs s/v", quantityPerUnit: 10, unit: "g" },
    { productName: "Basilic frais", quantityPerUnit: 5, unit: "feuille" },
    { productName: "Huile Olive/Peperoncino rosso 250ml (Coppini)", quantityPerUnit: 2, unit: "g" },
    { productName: "Filaments piment fort 470 ml (Wiberg)", quantityPerUnit: 1, unit: "pincée" },
  ]},
  { menuItemId: "pizza-carbonara", ingredients: [
    { productName: "Mozzarella Fior d'Italia Julienne VALCOLATTE", quantityPerUnit: 90, unit: "g" },
    { productName: "Guanciale Toscano (Rovagnati)", quantityPerUnit: 60, unit: "g" },
    { productName: "Oeuf", quantityPerUnit: 1, unit: "pièce" },
    { productName: "Parmigiano Reggiano Pointe 12mois env1kg s/v", quantityPerUnit: 10, unit: "g" },
    { productName: "Poivre du Sichuan en grains 470 ml", quantityPerUnit: 2, unit: "moulinet" },
    { productName: "Basilic frais", quantityPerUnit: 5, unit: "feuille" },
  ]},
  { menuItemId: "pizza-vegetarienne", ingredients: [
    { productName: "Mozzarella Fior d'Italia Julienne VALCOLATTE", quantityPerUnit: 90, unit: "g" },
    { productName: "Courgettes", quantityPerUnit: 12, unit: "tranche" },
    { productName: "Stracciatella 300grs (cartons de 8 pièces)", quantityPerUnit: 0.25, unit: "pièce" },
    { productName: "Parmigiano Reggiano Pointe 12mois env1kg s/v", quantityPerUnit: 10, unit: "g" },
    { productName: "Basilic frais", quantityPerUnit: 5, unit: "feuille" },
    { productName: "Huile d'Olive extra vierge Materia Prima 5 Litres (Coppini)", quantityPerUnit: 3, unit: "g" },
  ]},
];

console.log(`${NEW_PRODUCTS.length} nouveau(x) produit(s) à créer, ${UNIT_UPDATES.length} unité(s) à ajuster, ${RECIPES.length} recette(s) à créer.\n`);

for (const p of NEW_PRODUCTS) {
  const { data: existing } = await supabase.from("appro_products").select("id").eq("name", p.name).maybeSingle();
  if (existing) { console.log(`(déjà présent, ignoré) ${p.name}`); continue; }
  const { error } = await supabase.from("appro_products").insert({ name: p.name, unit: p.unit });
  if (error) { console.error(`ERREUR création "${p.name}"`, error); process.exit(1); }
  console.log(`Produit créé : ${p.name} (${p.unit})`);
}

for (const u of UNIT_UPDATES) {
  const { error } = await supabase.from("appro_products").update({ unit: u.unit }).eq("name", u.name);
  if (error) { console.error(`ERREUR maj unité "${u.name}"`, error); process.exit(1); }
  console.log(`Unité ajustée : ${u.name} → ${u.unit}`);
}

const { data: allProducts, error: allProdErr } = await supabase.from("appro_products").select("id, name");
if (allProdErr) { console.error(allProdErr); process.exit(1); }
const productIdByName = new Map(allProducts.map((p) => [p.name, p.id]));

console.log("\n--- Création des recettes ---");
let recipesCreated = 0;
let ingredientLines = 0;
const missingProducts = new Set();

for (const recipe of RECIPES) {
  const { data: existingRecipe } = await supabase.from("appro_recipes").select("id").eq("menu_item_id", recipe.menuItemId).maybeSingle();
  let recipeId = existingRecipe?.id;
  if (!recipeId) {
    const { data: created, error } = await supabase.from("appro_recipes").insert({ menu_item_id: recipe.menuItemId }).select().single();
    if (error) { console.error(`ERREUR création recette pour ${recipe.menuItemId}`, error); process.exit(1); }
    recipeId = created.id;
    recipesCreated++;
  } else {
    console.log(`(recette déjà existante, ingrédients ajoutés/mis à jour) ${recipe.menuItemId}`);
  }

  for (const ing of recipe.ingredients) {
    const productId = productIdByName.get(ing.productName);
    if (!productId) { missingProducts.add(ing.productName); continue; }
    const { data: existingLine } = await supabase
      .from("appro_recipe_ingredients")
      .select("id")
      .eq("recipe_id", recipeId)
      .eq("product_id", productId)
      .maybeSingle();
    if (existingLine) {
      await supabase.from("appro_recipe_ingredients").update({ quantity_per_unit: ing.quantityPerUnit, unit: ing.unit }).eq("id", existingLine.id);
    } else {
      const { error } = await supabase
        .from("appro_recipe_ingredients")
        .insert({ recipe_id: recipeId, product_id: productId, quantity_per_unit: ing.quantityPerUnit, unit: ing.unit });
      if (error) { console.error(`ERREUR ligne ingrédient "${ing.productName}" pour ${recipe.menuItemId}`, error); process.exit(1); }
    }
    ingredientLines++;
  }
}

console.log(`\n${recipesCreated} recette(s) créée(s), ${ingredientLines} ligne(s) ingrédient au total.`);
if (missingProducts.size > 0) console.log("\n⚠️  Produits introuvables (ligne ignorée) :", [...missingProducts]);
