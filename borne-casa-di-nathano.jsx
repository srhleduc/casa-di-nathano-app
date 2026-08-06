import React, { useState, useMemo, useRef, useEffect } from "react";

/* ---------------------------------------------------------------
   CASA DI NATHANO — Système de commande autonome
   Borne cliente + Espace équipe (créneaux + suivi cuisine)
   Tout est stocké dans le stockage partagé de l'artefact —
   aucune dépendance externe, fonctionne sur mobile et tablette.
---------------------------------------------------------------- */

const TEAM_PIN = "0505"; // à changer si besoin, demande-moi

const CATEGORIES = [
  { key: "pizza", label: "Pizzas", emoji: "🍕" },
  { key: "antipasti", label: "Antipasti", emoji: "🥖" },
  { key: "salade", label: "Salades", emoji: "🥗" },
  { key: "boisson", label: "Boissons", emoji: "🥤" },
  { key: "biere", label: "Bières", emoji: "🍺" },
  { key: "vin", label: "Vins", emoji: "🍷" },
  { key: "cocktail", label: "Cocktails", emoji: "🍸" },
  { key: "dessert", label: "Desserts", emoji: "🍰" },
];

let uid = 0;
const nextId = (p) => `${p}-${Date.now()}-${uid++}`;

// ---- MENU (nom + prix, plus besoin d'id Notion) ----
const MENU = [
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
  ["Supplément (base)", 2, "supplement"], ["Supplément Ananas", 2500, "supplement"], ["Supplément Anchois", 5, "supplement"],
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
].map(([name, price, cat]) => ({ id: nextId("m"), name, price, cat }));

// Liste des ingrédients disponibles pour construire la recette d'une nouvelle pizza
const INGREDIENT_NAMES = MENU.filter((m) => m.cat === "sans").map((m) => m.name.replace("Sans ", "")).sort();

// Composition des pizzas — sert à proposer "retirer un ingrédient" pertinent pour chacune
// Stock du jour pour certains desserts — le coulis étant ajouté indépendamment,
// les deux Pana Cotta partagent un même stock ; les Tiramisu sont comptés séparément.
const DESSERT_STOCK_GROUPS = [
  { key: "pannacotta", label: "Panna Cotta", itemNames: ["Pana Cotta Framboise", "Pana Cotta Mangue"] },
  { key: "tiramisu_cafe", label: "Tiramisu Café", itemNames: ["Tiramisu Café"] },
  { key: "tiramisu_speculoos", label: "Tiramisu Spéculoos", itemNames: ["Tiramisu Spéculoos"] },
  { key: "paris_palerme", label: "Paris Palerme", itemNames: ["Paris Palerme"] },
];

const PIZZA_RECIPES = {
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

const GLACE_FLAVORS = ["Vanille", "Fior di latte", "Chocolat", "Stracciatella", "Cerise amarena", "Citron", "Noisette", "Pistache", "Fraise"];
const SIROP_FLAVORS = ["Fraise", "Framboise", "Pêche", "Menthe", "Grenadine", "Vanille", "Citron", "Mojito", "Litchi", "Yuzu", "Caramel", "Fruit de la passion", "Basilic", "Orgeat"];

function flavorConfigFor(name) {
  if (name === "Glace 1 boule") return { flavors: GLACE_FLAVORS, need: 1, icon: "🍨" };
  if (name === "Glace 2 boules") return { flavors: GLACE_FLAVORS, need: 2, icon: "🍨" };
  if (name === "Glace 3 boules") return { flavors: GLACE_FLAVORS, need: 3, icon: "🍨" };
  if (name === "Sirop à l'eau") return { flavors: SIROP_FLAVORS, need: 1, icon: "💧" };
  if (name === "Diabolo") return { flavors: SIROP_FLAVORS, need: 1, icon: "💧" };
  return null;
}
const eur = (n) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

// ---------------- stockage partagé (borne + équipe) ----------------
async function loadSlots() {
  try {
    const r = await window.storage.get("slots", true);
    return r ? JSON.parse(r.value) : [];
  } catch {
    return [];
  }
}
async function saveSlots(slots) {
  const result = await window.storage.set("slots", JSON.stringify(slots), true);
  if (!result) throw new Error("Échec silencieux de l'enregistrement des créneaux");
}
async function loadOrders() {
  try {
    const r = await window.storage.get("orders", true);
    return r ? JSON.parse(r.value) : [];
  } catch {
    return [];
  }
}
async function saveOrders(orders) {
  const result = await window.storage.set("orders", JSON.stringify(orders), true);
  if (!result) throw new Error("Échec silencieux de l'enregistrement des commandes");
}
async function loadRuptures() {
  try {
    const r = await window.storage.get("ruptures", true);
    return r ? JSON.parse(r.value) : [];
  } catch {
    return [];
  }
}
async function saveRuptures(ids) {
  const result = await window.storage.set("ruptures", JSON.stringify(ids), true);
  if (!result) throw new Error("Échec silencieux de l'enregistrement des ruptures");
}
async function loadDessertStock() {
  try {
    const r = await window.storage.get("dessertStock", true);
    return r ? JSON.parse(r.value) : {};
  } catch {
    return {};
  }
}
async function saveDessertStock(stock) {
  const result = await window.storage.set("dessertStock", JSON.stringify(stock), true);
  if (!result) throw new Error("Échec silencieux de l'enregistrement du stock desserts");
}
async function loadCustomMenuItems() {
  try {
    const r = await window.storage.get("customMenuItems", true);
    return r ? JSON.parse(r.value) : [];
  } catch {
    return [];
  }
}
async function saveCustomMenuItems(items) {
  const result = await window.storage.set("customMenuItems", JSON.stringify(items), true);
  if (!result) throw new Error("Échec silencieux de l'enregistrement des nouveaux produits");
}
const EMPTY_PLAN = { defaultLayout: { interieur: [], exterieur: [], mangedebout: [] }, currentLayout: { interieur: [], exterieur: [], mangedebout: [] } };
async function loadTablePlan() {
  try {
    const r = await window.storage.get("tablePlan", true);
    return r ? JSON.parse(r.value) : EMPTY_PLAN;
  } catch {
    return EMPTY_PLAN;
  }
}
async function saveTablePlan(plan) {
  const result = await window.storage.set("tablePlan", JSON.stringify(plan), true);
  if (!result) throw new Error("Échec silencieux de l'enregistrement du plan de table");
}
function remainingForDessertGroup(orders, dessertStock, group) {
  const made = dessertStock[group.key] || 0;
  const used = orders
    .flatMap((o) => o.items)
    .filter((it) => group.itemNames.includes(it.name))
    .reduce((s, it) => s + it.qty, 0);
  return made - used;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateStrFromTimestamp(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isOrderFromPastAndStale(order) {
  const isFromToday = dateStrFromTimestamp(order.createdAt) === todayStr();
  return !isFromToday && !isOrderScheduledLater(order);
}
function isOrderActiveToday(order) {
  return !order.scheduledFor || order.scheduledFor === todayStr();
}
function isOrderScheduledLater(order) {
  return !!order.scheduledFor && order.scheduledFor !== todayStr();
}
function formatFrenchDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function parseMinutes(label) {
  const m = String(label).match(/(\d{1,2})[:h](\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function minutesFromNow(label) {
  const mins = parseMinutes(label);
  if (mins === null) return null;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return Math.max(0, mins - nowMinutes);
}

function cartSignature(id, note, modifiers) {
  const modKey = (modifiers || []).map((m) => m.name).sort().join(",");
  return `${id}|${note || ""}|${modKey}`;
}
function lineUnitPrice(item) {
  return item.price + (item.modifiers || []).reduce((s, m) => s + m.price, 0);
}

function withAutoFocaccia(next, item, phase) {
  if (!item.name.startsWith("Planche")) return next;
  const focaccia = MENU.find((m) => m.name === "Focaccia");
  if (!focaccia) return next;
  const existing = next.find((i) => i.id === focaccia.id && !i.note && i.phase === phase);
  if (existing) return next.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i));
  return [...next, { ...focaccia, qty: 1, note: null, phase }];
}

function remainingForSlot(orders, slot) {
  const used = orders
    .filter((o) => o.status !== "servie")
    .flatMap((o) => o.slotAllocations || [])
    .filter((a) => a.slotId === slot.id)
    .reduce((s, a) => s + a.qty, 0);
  return slot.capacity - used;
}

// Découpe automatique sur des créneaux qui se suivent strictement — jamais de créneau sauté.
function buildPlan(orders, slots, needed) {
  if (needed === 0) return [];
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const upcoming = slots
    .map((s) => ({ ...s, mins: parseMinutes(s.label), remaining: remainingForSlot(orders, s) }))
    .filter((s) => s.mins !== null && s.mins > nowMinutes)
    .sort((a, b) => a.mins - b.mins);

  for (let start = 0; start < upcoming.length; start++) {
    if (upcoming[start].remaining <= 0) continue; // ne peut pas démarrer sur un créneau plein
    let left = needed;
    const candidate = [];
    let idx = start;
    while (left > 0 && idx < upcoming.length) {
      const slot = upcoming[idx];
      if (slot.remaining <= 0) { candidate.length = 0; break; } // créneau plein au milieu → chaîne cassée, on abandonne ce départ
      const take = Math.min(slot.remaining, left);
      candidate.push({ slotId: slot.id, label: slot.label, qty: take });
      left -= take;
      idx++;
    }
    if (left === 0 && candidate.length > 0) return candidate;
  }
  return null; // aucune suite de créneaux consécutifs ne suffit
}

// Calcule les options de créneau à proposer au client :
// - s'il existe au moins un créneau seul capable d'absorber toute la commande, on les liste tous (le plus proche en premier)
// - sinon, on tente une répartition automatique sur plusieurs créneaux qui se suivent
function computeSlotOptions(orders, slots, needed) {
  if (needed === 0) return { mode: "single", options: [] };
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const upcoming = slots
    .map((s) => ({ ...s, mins: parseMinutes(s.label), remaining: remainingForSlot(orders, s) }))
    .filter((s) => s.mins !== null && s.mins > nowMinutes)
    .sort((a, b) => a.mins - b.mins);

  const singleFits = upcoming.filter((s) => s.remaining >= needed);
  if (singleFits.length > 0) return { mode: "single", options: singleFits };

  const plan = buildPlan(orders, slots, needed);
  if (plan) return { mode: "split", plan };
  return { mode: "none" };
}

export default function Kiosk() {
  const [mode, setMode] = useState("client"); // client | pin | team
  const [teamUnlocked, setTeamUnlocked] = useState(false); // mémorise l'accès équipe pour toute la session
  const [screen, setScreen] = useState("welcome");
  const [activeCat, setActiveCat] = useState("pizza");
  const [cart, setCart] = useState([]);
  const [serviceType, setServiceType] = useState("🍽️ Sur place");
  const [tableName, setTableName] = useState("");
  const [slots, setSlots] = useState([]);
  const lastSlotsWrite = useRef(0);
  const [orders, setOrders] = useState([]);
  const [ruptures, setRuptures] = useState([]); // ids d'articles en rupture
  const [dessertStock, setDessertStock] = useState({}); // { groupKey: quantité faite aujourd'hui }
  const [customMenuItems, setCustomMenuItems] = useState([]); // nouveaux produits créés par l'équipe
  const [tablePlan, setTablePlan] = useState(EMPTY_PLAN); // plan de table intérieur/extérieur
  const fullMenu = useMemo(() => [...MENU, ...customMenuItems], [customMenuItems]);
  const [slotChoice, setSlotChoice] = useState(null); // résultat de computeSlotOptions
  const [selectedSlot, setSelectedSlot] = useState(null); // créneau choisi si mode "single"
  const [customizing, setCustomizing] = useState(null); // pizza en cours de personnalisation
  const [flavoring, setFlavoring] = useState(null); // glace en cours de choix de parfum
  const [aperoMode, setAperoMode] = useState(false); // vrai tant que le client n'a pas validé son apéro

  const total = useMemo(() => cart.reduce((s, i) => s + lineUnitPrice(i) * i.qty, 0), [cart]);
  const itemCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);
  const pizzaCount = useMemo(() => cart.filter((i) => i.cat === "pizza").reduce((s, i) => s + i.qty, 0), [cart]);

  useEffect(() => {
    loadSlots().then(setSlots);
    loadOrders().then(setOrders);
    loadRuptures().then(setRuptures);
    loadDessertStock().then(setDessertStock);
    loadCustomMenuItems().then(setCustomMenuItems);
    loadTablePlan().then(setTablePlan);
    // Pas de rafraîchissement automatique en arrière-plan : le stockage peut renvoyer
    // des données périmées et écraser des commandes tout juste enregistrées.
    // On recharge à la demande via le bouton "🔄 Actualiser".
  }, []);

  function addItem(item, note) {
    setCart((prev) => {
      const existing = prev.find((i) => cartSignature(i.id, i.note, i.modifiers) === cartSignature(item.id, note, null));
      let next = existing
        ? prev.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i))
        : [...prev, { ...item, qty: 1, note: note || null, modifiers: [] }];
      return withAutoFocaccia(next, item);
    });
  }
  function addCustomizedPizza(pizzaItem, removedItems, addedItems) {
    const modifiers = [
      ...removedItems.map((i) => ({ name: i.name, price: i.price })),
      ...addedItems.map((i) => ({ name: i.name, price: i.price })),
    ];
    setCart((prev) => {
      const sig = cartSignature(pizzaItem.id, null, modifiers);
      const existing = prev.find((i) => cartSignature(i.id, i.note, i.modifiers) === sig);
      if (existing) return prev.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { ...pizzaItem, qty: 1, note: null, modifiers }];
    });
    setCustomizing(null);
  }
  function changeQty(id, note, modifiers, delta) {
    const sig = cartSignature(id, note, modifiers);
    setCart((prev) => prev.map((i) => (cartSignature(i.id, i.note, i.modifiers) === sig ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0));
  }
  function resetAll() {
    setCart([]);
    setTableName("");
    setServiceType("🍽️ Sur place");
    setActiveCat("pizza");
    setSlotChoice(null);
    setSelectedSlot(null);
    setAperoMode(false);
    setScreen("welcome");
  }

  function submitOrder(finalPlan) {
    const newOrder = {
      id: nextId("o"),
      items: cart.map(({ id, name, price, cat, qty, note, modifiers }) => ({ id, name, price, cat, qty, note, modifiers })),
      serviceType,
      name: tableName || "Client borne",
      slotAllocations: finalPlan || [],
      pizzaCount,
      total,
      status: "attente",
      createdAt: Date.now(),
    };
    const merged = [...orders, newOrder];
    setOrders(merged);
    setScreen("done");
    const trySave = (attempt) => {
      saveOrders(merged).catch((err) => {
        if (attempt < 3) setTimeout(() => trySave(attempt + 1), 400);
        else console.error("Échec définitif de l'enregistrement de la commande", err);
      });
    };
    trySave(1);
  }

  function goToSlot() {
    if (pizzaCount === 0) {
      submitOrder(null);
      return;
    }
    const choice = computeSlotOptions(orders, slots, pizzaCount);
    if (serviceType === "🍽️ Sur place" && choice.mode !== "none") {
      const finalPlan =
        choice.mode === "split" ? choice.plan : [{ slotId: choice.options[0].id, label: choice.options[0].label, qty: pizzaCount }];
      setSlotChoice(choice);
      submitOrder(finalPlan);
      return;
    }
    setSelectedSlot(null);
    setSlotChoice(choice);
    setScreen("slot");
  }

  if (mode === "pin") return <PinScreen onSuccess={() => { setTeamUnlocked(true); setMode("team"); }} onCancel={() => setMode("client")} />;
  if (mode === "team")
    return (
      <TeamSpace
        slots={slots}
        setSlots={(s) => {
          setSlots(s);
          lastSlotsWrite.current = Date.now();
          const trySave = (attempt) => {
            saveSlots(s).catch((err) => {
              if (attempt < 3) {
                setTimeout(() => trySave(attempt + 1), 400);
              } else {
                console.error("Échec définitif de l'enregistrement des créneaux", err);
              }
            });
          };
          trySave(1);
        }}
        orders={orders}
        setOrders={(o) => {
          setOrders(o);
          const trySave = (attempt) => {
            saveOrders(o).catch((err) => {
              if (attempt < 3) setTimeout(() => trySave(attempt + 1), 400);
              else console.error("Échec définitif de l'enregistrement des commandes", err);
            });
          };
          trySave(1);
        }}
        ruptures={ruptures}
        setRuptures={(r) => {
          setRuptures(r);
          const trySave = (attempt) => {
            saveRuptures(r).catch((err) => {
              if (attempt < 3) setTimeout(() => trySave(attempt + 1), 400);
              else console.error("Échec définitif de l'enregistrement des ruptures", err);
            });
          };
          trySave(1);
        }}
        dessertStock={dessertStock}
        setDessertStock={(d) => {
          setDessertStock(d);
          const trySave = (attempt) => {
            saveDessertStock(d).catch((err) => {
              if (attempt < 3) setTimeout(() => trySave(attempt + 1), 400);
              else console.error("Échec définitif de l'enregistrement du stock desserts", err);
            });
          };
          trySave(1);
        }}
        customMenuItems={customMenuItems}
        setCustomMenuItems={(items) => {
          setCustomMenuItems(items);
          const trySave = (attempt) => {
            saveCustomMenuItems(items).catch((err) => {
              if (attempt < 3) setTimeout(() => trySave(attempt + 1), 400);
              else console.error("Échec définitif de l'enregistrement des produits", err);
            });
          };
          trySave(1);
        }}
        tablePlan={tablePlan}
        setTablePlan={(p) => {
          setTablePlan(p);
          const trySave = (attempt) => {
            saveTablePlan(p).catch((err) => {
              if (attempt < 3) setTimeout(() => trySave(attempt + 1), 400);
              else console.error("Échec définitif de l'enregistrement du plan de table", err);
            });
          };
          trySave(1);
        }}
        onExit={() => setMode("client")}
      />
    );

  return (
    <div className="kiosk-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,500&family=Manrope:wght@500;600;700;800&display=swap');
        .kiosk-root { font-family:'Manrope',sans-serif; background:radial-gradient(ellipse at 50% -10%, #3a2013 0%, #1a120b 55%, #120c07 100%); color:#f5ebdd; min-height:100vh; width:100%; display:flex; flex-direction:column; overflow:hidden; }
        .display-font { font-family:'Fraunces',serif; }
        .oven-glow { position:absolute; inset:0; pointer-events:none; background:radial-gradient(circle at 50% 0%, rgba(196,67,43,0.18) 0%, transparent 55%); }
        .tap-scale { transition: transform 0.08s ease, filter 0.08s ease, box-shadow 0.08s ease; }
        .tap-scale:active { transform: scale(0.93); filter: brightness(1.25); box-shadow: 0 0 0 3px rgba(232,178,61,0.5) inset; }
        .ticket-edge { background-image:radial-gradient(circle at 8px 0, transparent 8px, #241811 8.5px); background-size:16px 16px; background-position:top; background-repeat:repeat-x; }
      `}</style>

      {screen === "welcome" && <WelcomeScreen onStart={() => setScreen("service")} onTeam={() => setMode(teamUnlocked ? "team" : "pin")} />}

      {screen === "service" && (
        <ServiceTypeScreen
          onSelect={(type) => {
            setServiceType(type);
            if (type === "🍽️ Sur place") setScreen("apero-ask");
            else {
              setAperoMode(false);
              setActiveCat("pizza");
              setScreen("order");
            }
          }}
        />
      )}

      {screen === "apero-ask" && (
        <AperoAskScreen
          onAnswer={(wantsApero) => {
            if (wantsApero) {
              setAperoMode(true);
              setActiveCat("boisson");
            } else {
              setAperoMode(false);
              setActiveCat("pizza");
            }
            setScreen("order");
          }}
        />
      )}

      {screen === "order" && (
        <OrderScreen
          activeCat={activeCat}
          setActiveCat={setActiveCat}
          cart={cart}
          addItem={addItem}
          onPizzaTap={setCustomizing}
          onGlaceTap={setFlavoring}
          changeQty={changeQty}
          total={total}
          itemCount={itemCount}
          onCancel={resetAll}
          onCheckout={() => setScreen("checkout")}
          aperoMode={aperoMode}
          ruptures={ruptures}
          orders={orders}
          dessertStock={dessertStock}
          menu={fullMenu}
          showPhotos={true}
          onFinishApero={() => {
            setAperoMode(false);
            setActiveCat("pizza");
          }}
        />
      )}

      {customizing && (
        <PizzaCustomizeModal
          pizza={customizing}
          onClose={() => setCustomizing(null)}
          onConfirm={(removedItems, addedItems) => addCustomizedPizza(customizing, removedItems, addedItems)}
        />
      )}

      {flavoring && (
        <FlavorModal
          item={flavoring}
          onClose={() => setFlavoring(null)}
          onConfirm={(note) => {
            addItem(flavoring, note);
            setFlavoring(null);
          }}
        />
      )}

      {screen === "checkout" && (
        <CheckoutScreen
          cart={cart}
          changeQty={changeQty}
          total={total}
          pizzaCount={pizzaCount}
          serviceType={serviceType}
          setServiceType={setServiceType}
          tableName={tableName}
          setTableName={setTableName}
          onBack={() => setScreen("order")}
          onConfirm={goToSlot}
        />
      )}

      {screen === "slot" && (
        <SlotScreen
          pizzaCount={pizzaCount}
          slotChoice={slotChoice}
          selectedSlot={selectedSlot}
          setSelectedSlot={setSelectedSlot}
          allSlotsConfigured={slots.length > 0}
          onBack={() => setScreen("checkout")}
          onConfirm={() => {
            const finalPlan =
              slotChoice.mode === "split"
                ? slotChoice.plan
                : selectedSlot
                ? [{ slotId: selectedSlot.id, label: selectedSlot.label, qty: pizzaCount }]
                : null;
            submitOrder(finalPlan);
          }}
        />
      )}

      {screen === "done" && (
        <StatusScreen title="Commande envoyée !" subtitle={onSiteDoneMessage()} success onDone={resetAll} />
      )}
    </div>
  );

  function onSiteDoneMessage() {
    if (serviceType === "🍽️ Sur place" && slotChoice && slotChoice.mode !== "none") {
      const label = slotChoice.mode === "split" ? slotChoice.plan[0].label : slotChoice.options[0].label;
      const mins = minutesFromNow(label);
      return mins !== null
        ? `Votre commande sera lancée dans les ${Math.max(5, Math.ceil(mins / 5) * 5)} prochaines minutes (vers ${label}).`
        : `Merci ${tableName ? tableName + " " : ""}— votre commande est partie en cuisine.`;
    }
    return `Merci ${tableName ? tableName + " " : ""}— rends-toi en caisse pour régler.`;
  }
}

function WelcomeScreen({ onStart, onTeam }) {
  return (
    <div className="relative flex-1 flex flex-col items-center justify-center px-8 text-center">
      <div className="oven-glow" />
      <div className="relative z-10 flex flex-col items-center">
        <span className="text-7xl mb-6">🌿</span>
        <h1 className="display-font text-6xl font-semibold tracking-tight mb-3">Casa Di Nathano</h1>
        <p className="text-[#c9b8a4] text-xl mb-14">Pizza façonnée à la main, four à bois, tous les jours.</p>
        <button onClick={onStart} className="tap-scale rounded-full px-16 py-7 text-2xl font-bold display-font italic" style={{ background: "#C0392B", color: "#fff5ea", boxShadow: "0 12px 30px rgba(192,57,43,0.35)" }}>
          Commencer ma commande
        </button>
        <p className="text-[#8a7561] text-sm mt-8 tracking-wide uppercase">Paiement en caisse après validation</p>
      </div>
      <button onClick={onTeam} className="absolute bottom-6 right-6 text-[#5a4a3a] text-xs tap-scale">
        Espace équipe
      </button>
    </div>
  );
}

function ServiceTypeScreen({ onSelect }) {
  const options = [
    { value: "🍽️ Sur place", label: "Sur place", desc: "Je m'installe en salle" },
    { value: "🥡 À emporter", label: "À emporter", desc: "Je repars avec ma commande" },
  ];
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <h2 className="display-font text-4xl font-semibold mb-10">Sur place ou à emporter ?</h2>
      <div className="flex flex-col md:flex-row gap-5 w-full max-w-xl">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onSelect(o.value)}
            className="tap-scale flex-1 rounded-3xl border-2 border-[#3a2b1f] bg-[#211712] px-8 py-10 flex flex-col items-center gap-2"
          >
            <span className="display-font text-3xl font-bold">{o.label}</span>
            <span className="text-[#a88f78]">{o.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AperoAskScreen({ onAnswer }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <span className="text-6xl mb-6">🍸</span>
      <h2 className="display-font text-4xl font-semibold mb-3">Un apéritif pour commencer ?</h2>
      <p className="text-[#a88f78] mb-10">On vous propose d'abord les boissons et planches, vos pizzas viendront juste après.</p>
      <div className="flex gap-5">
        <button onClick={() => onAnswer(true)} className="tap-scale rounded-full px-12 py-6 text-xl font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
          Oui, avec plaisir
        </button>
        <button onClick={() => onAnswer(false)} className="tap-scale rounded-full px-12 py-6 text-xl font-bold border-2 border-[#3a2b1f]">
          Non, allons-y direct
        </button>
      </div>
    </div>
  );
}

function OrderScreen({ activeCat, setActiveCat, cart, addItem, onPizzaTap, onGlaceTap, changeQty, total, itemCount, onCancel, onCheckout, aperoMode, onFinishApero, ruptures, orders, dessertStock, menu, showPhotos }) {
  const fullMenu = menu || MENU;
  const APERO_CATS = ["boisson", "antipasti", "biere", "vin", "cocktail"];
  const visibleCategories = aperoMode ? CATEGORIES.filter((c) => APERO_CATS.includes(c.key)) : CATEGORIES;
  function isDessertOut(name) {
    const group = DESSERT_STOCK_GROUPS.find((g) => g.itemNames.includes(name));
    if (!group) return false;
    return remainingForDessertGroup(orders || [], dessertStock || {}, group) <= 0;
  }
  const items = fullMenu.filter((m) => m.cat === activeCat && !(ruptures || []).includes(m.id) && !isDessertOut(m.name));
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a2b1f]">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌿</span>
          <span className="display-font text-xl font-semibold">Casa Di Nathano</span>
        </div>
        <button onClick={onCancel} className="text-[#c9b8a4] text-sm font-semibold px-4 py-2 rounded-full border border-[#4a3826] tap-scale">
          Annuler la commande
        </button>
      </div>

      {aperoMode && (
        <div className="mx-6 mt-4 rounded-2xl px-5 py-4 flex items-center justify-between" style={{ background: "#2c1c14", border: "1px solid #C0392B" }}>
          <div>
            <div className="font-bold">🍸 Commande apéritif</div>
            <div className="text-[#a88f78] text-sm">Boissons et planches — les pizzas arrivent juste après</div>
          </div>
          <button onClick={onFinishApero} className="tap-scale rounded-full px-5 py-3 font-bold text-sm shrink-0" style={{ background: "#C0392B", color: "#fff5ea" }}>
            Valider et poursuivre →
          </button>
        </div>
      )}

      <div className="flex gap-3 px-6 py-4 overflow-x-auto">
        {visibleCategories.map((c) => (
          <button key={c.key} onClick={() => setActiveCat(c.key)} className={`tap-scale shrink-0 flex flex-col items-center justify-center gap-1 rounded-2xl px-6 py-4 border-2 ${activeCat === c.key ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f] bg-[#221812]"}`}>
            <span className="text-3xl">{c.emoji}</span>
            <span className="text-sm font-bold">{c.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-40">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {items.map((item) => {
            const inCart = cart.filter((i) => i.id === item.id).reduce((s, i) => s + i.qty, 0);
            const needsFlavor = flavorConfigFor(item.name) !== null;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.cat === "pizza" && item.price > 0) onPizzaTap(item);
                  else if (needsFlavor) onGlaceTap(item);
                  else addItem(item);
                }}
                className="tap-scale relative text-left rounded-2xl border border-[#3a2b1f] bg-[#211712] flex flex-col justify-between min-h-[110px] overflow-hidden"
              >
                {inCart > 0 && <span className="absolute top-2 right-2 z-10 bg-[#C0392B] text-white text-sm font-bold rounded-full w-8 h-8 flex items-center justify-center">{inCart}</span>}
                {showPhotos && item.photoUrl && (
                  <img src={item.photoUrl} alt={item.name} className="w-full h-28 object-cover" />
                )}
                <div className="p-5 flex flex-col flex-1 justify-between">
                  <span className="font-bold text-lg leading-snug">{item.name}</span>
                  <span className="display-font italic text-[#E8B23D] text-lg mt-2">{item.price === 0 ? "Offert" : eur(item.price)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 px-6 py-5 flex items-center justify-between ticket-edge bg-[#241811] border-t border-[#4a3826]">
          <div>
            <div className="text-sm text-[#a88f78] font-semibold">{itemCount} article{itemCount > 1 ? "s" : ""}</div>
            <div className="display-font text-2xl font-bold text-[#E8B23D]">{eur(total)}</div>
          </div>
          <button onClick={onCheckout} className="tap-scale rounded-full px-10 py-5 text-xl font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
            Voir mon panier →
          </button>
        </div>
      )}
    </div>
  );
}

function PizzaCustomizeModal({ pizza, onClose, onConfirm }) {
  const [mode, setMode] = useState("detail"); // detail | remove | add
  const [removedNames, setRemovedNames] = useState([]); // noms d'ingrédients (sans préfixe)
  const [addedIds, setAddedIds] = useState([]); // ids d'articles Supp. sélectionnés
  const [showOtherSupp, setShowOtherSupp] = useState(false);

  const recipe = PIZZA_RECIPES[pizza.name] || pizza.ingredients || [];
  const FEATURED_NAMES = ["Supplément Anchois", "Supplément Cœur de Burrata", "Supplément Mozzarella di Buffala", "Supplément Salade"];
  const allSupplements = MENU.filter((m) => m.cat === "supplement");
  const featuredSupplements = FEATURED_NAMES.map((n) => allSupplements.find((s) => s.name === n)).filter(Boolean);
  const otherSupplements = allSupplements.filter((s) => !FEATURED_NAMES.includes(s.name));

  function toggleRemoved(name) {
    setRemovedNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }
  function toggleAdded(id) {
    setAddedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  function confirm() {
    const removedItems = removedNames
      .map((n) => MENU.find((m) => m.cat === "sans" && m.name === `Sans ${n}`))
      .filter(Boolean);
    const addedItems = addedIds.map((id) => MENU.find((m) => m.id === id)).filter(Boolean);
    onConfirm(removedItems, addedItems);
  }

  const extraCount = removedNames.length + addedIds.length;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70">
      <div className="pizza-modal w-full md:max-w-2xl md:rounded-3xl overflow-hidden flex flex-col" style={{ background: "#1a120b", color: "#f5ebdd", height: "min(92vh, 720px)" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,700&family=Manrope:wght@500;600;700;800&display=swap');
          .pizza-modal { font-family:'Manrope',sans-serif; }
          .display-font { font-family:'Fraunces',serif; }
          .tap-scale { transition: transform 0.08s ease, filter 0.08s ease; }
          .tap-scale:active { transform: scale(0.94); filter: brightness(1.2); }
          .chip { border-radius: 999px; padding: 10px 18px; font-weight: 700; border: 2px solid #3a2b1f; }
        `}</style>

        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a2b1f]">
          <span className="display-font text-2xl font-bold">{pizza.name}</span>
          <button onClick={onClose} className="tap-scale w-9 h-9 rounded-full bg-[#241811] text-[#c9b8a4] font-bold">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {mode === "detail" && (
            <>
              <div className="display-font italic text-2xl text-[#E8B23D] mb-4">{eur(pizza.price)}</div>
              {recipe.length > 0 && (
                <>
                  <div className="text-sm font-bold text-[#a88f78] uppercase tracking-wide mb-2">Ingrédients</div>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {recipe.map((n) => (
                      <span key={n} className="chip text-sm text-[#c9b8a4]">{n}</span>
                    ))}
                  </div>
                </>
              )}
              {recipe.length > 0 && (
                <button onClick={() => setMode("remove")} className="tap-scale w-full rounded-xl py-4 font-bold border-2 border-[#3a2b1f] mb-3">
                  🎛️ Personnaliser cette pizza
                </button>
              )}
            </>
          )}

          {(mode === "remove" || mode === "add") && (
            <>
              <div className="flex gap-3 mb-5">
                <button onClick={() => setMode("remove")} className={`tap-scale flex-1 rounded-xl py-3 font-bold border-2 ${mode === "remove" ? "border-[#C0392B]" : "border-[#3a2b1f]"}`} style={mode === "remove" ? { background: "#2c1c14" } : {}}>
                  ➖ Retirer un ingrédient
                </button>
                <button onClick={() => setMode("add")} className={`tap-scale flex-1 rounded-xl py-3 font-bold border-2 ${mode === "add" ? "border-[#C0392B]" : "border-[#3a2b1f]"}`} style={mode === "add" ? { background: "#2c1c14" } : {}}>
                  ➕ Ajouter un supplément
                </button>
              </div>

              {mode === "remove" && (
                <div className="flex flex-wrap gap-2">
                  {recipe.map((n) => {
                    const isOff = removedNames.includes(n);
                    return (
                      <button
                        key={n}
                        onClick={() => toggleRemoved(n)}
                        className="chip tap-scale"
                        style={isOff ? { background: "#C0392B", borderColor: "#C0392B", color: "#fff5ea" } : { color: "#c9b8a4" }}
                      >
                        {isOff ? "✕ Sans " : ""}{n}
                      </button>
                    );
                  })}
                </div>
              )}

              {mode === "add" && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {featuredSupplements.map((s) => {
                      const isOn = addedIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleAdded(s.id)}
                          className="chip tap-scale"
                          style={isOn ? { background: "#C0392B", borderColor: "#C0392B", color: "#fff5ea" } : { color: "#c9b8a4" }}
                        >
                          {isOn ? "✓ " : "+ "}{s.name.replace("Supplément ", "")} {s.price > 0 ? `(${eur(s.price)})` : ""}
                        </button>
                      );
                    })}
                  </div>

                  {!showOtherSupp && (
                    <button onClick={() => setShowOtherSupp(true)} className="tap-scale mt-4 text-[#c9b8a4] font-semibold underline underline-offset-4">
                      Autres suppléments…
                    </button>
                  )}

                  {showOtherSupp && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#3a2b1f]">
                      {otherSupplements.map((s) => {
                        const isOn = addedIds.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            onClick={() => toggleAdded(s.id)}
                            className="chip tap-scale"
                            style={isOn ? { background: "#C0392B", borderColor: "#C0392B", color: "#fff5ea" } : { color: "#c9b8a4" }}
                          >
                            {isOn ? "✓ " : "+ "}{s.name} {s.price > 0 ? `(${eur(s.price)})` : ""}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-5 border-t border-[#3a2b1f]">
          <button onClick={confirm} className="tap-scale w-full rounded-full py-5 text-xl font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
            Ajouter au panier{extraCount > 0 ? ` (${extraCount} modif.)` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function FlavorModal({ item, onClose, onConfirm }) {
  const { flavors, need } = flavorConfigFor(item.name);
  const [picked, setPicked] = useState([]);

  function toggle(f) {
    setPicked((prev) => {
      if (prev.includes(f)) return prev.filter((x) => x !== f);
      if (prev.length >= need) return [...prev.slice(1), f]; // remplace le plus ancien choix une fois le quota atteint
      return [...prev, f];
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70">
      <div className="pizza-modal w-full md:max-w-2xl md:rounded-3xl overflow-hidden flex flex-col" style={{ background: "#1a120b", color: "#f5ebdd", height: "min(80vh, 640px)" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,700&family=Manrope:wght@500;600;700;800&display=swap');
          .pizza-modal { font-family:'Manrope',sans-serif; }
          .display-font { font-family:'Fraunces',serif; }
          .tap-scale { transition: transform 0.08s ease, filter 0.08s ease; }
          .tap-scale:active { transform: scale(0.94); filter: brightness(1.2); }
          .chip { border-radius: 999px; padding: 10px 18px; font-weight: 700; border: 2px solid #3a2b1f; }
        `}</style>

        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a2b1f]">
          <span className="display-font text-2xl font-bold">{item.name}</span>
          <button onClick={onClose} className="tap-scale w-9 h-9 rounded-full bg-[#241811] text-[#c9b8a4] font-bold">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="text-[#a88f78] mb-4">Choisis {need} parfum{need > 1 ? "s" : ""} ({picked.length}/{need})</p>
          <div className="flex flex-wrap gap-2">
            {flavors.map((f) => {
              const isOn = picked.includes(f);
              return (
                <button
                  key={f}
                  onClick={() => toggle(f)}
                  className="chip tap-scale"
                  style={isOn ? { background: "#C0392B", borderColor: "#C0392B", color: "#fff5ea" } : { color: "#c9b8a4" }}
                >
                  {isOn ? "✓ " : ""}{f}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-5 border-t border-[#3a2b1f]">
          <button
            onClick={() => onConfirm(picked.join(", "))}
            disabled={picked.length !== need}
            className="tap-scale w-full rounded-full py-5 text-xl font-bold disabled:opacity-40"
            style={{ background: "#C0392B", color: "#fff5ea" }}
          >
            Ajouter au panier
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckoutScreen({ cart, changeQty, total, pizzaCount, serviceType, setServiceType, tableName, setTableName, onBack, onConfirm }) {
  const options = ["🍽️ Sur place", "🥡 À emporter"];
  return (
    <div className="flex-1 flex flex-col px-6 py-6 overflow-y-auto">
      <button onClick={onBack} className="text-[#c9b8a4] text-sm font-semibold mb-6 self-start tap-scale">← Continuer mes achats</button>
      <h2 className="display-font text-3xl font-semibold mb-6">Ma commande</h2>

      <div className="flex-1 flex flex-col gap-3 mb-6">
        {cart.map((i) => (
          <div key={i.id + "-" + (i.note || "") + "-" + (i.modifiers || []).map((m) => m.name).join(",")} className="flex items-center justify-between rounded-xl border border-[#3a2b1f] bg-[#211712] px-4 py-3">
            <div>
              <div className="font-bold">{i.name}</div>
              {i.note && <div className="text-xs text-[#E8B23D] pl-3">↳ {flavorConfigFor(i.name)?.icon || "🍨"} {i.note}</div>}
              {(i.modifiers || []).map((m, mi) => (
                <div key={mi} className="text-xs text-[#a88f78] pl-3">
                  ↳ {m.name}{m.price > 0 ? ` (+${eur(m.price)})` : ""}
                </div>
              ))}
              <div className="text-[#a88f78] text-sm mt-1">{eur(lineUnitPrice(i))} / unité</div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => changeQty(i.id, i.note, i.modifiers, -1)} className="tap-scale w-9 h-9 rounded-full bg-[#3a2b1f] text-xl font-bold">−</button>
              <span className="w-6 text-center font-bold">{i.qty}</span>
              <button onClick={() => changeQty(i.id, i.note, i.modifiers, 1)} className="tap-scale w-9 h-9 rounded-full bg-[#3a2b1f] text-xl font-bold">+</button>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <div className="text-sm font-bold text-[#a88f78] uppercase tracking-wide mb-2">Type de commande</div>
        <div className="flex gap-3">
          {options.map((opt) => {
            const isSelected = serviceType === opt;
            return (
              <button
                key={opt}
                onClick={() => setServiceType(opt)}
                className="tap-scale flex-1 rounded-xl py-4 font-bold border-2 flex items-center justify-center gap-2"
                style={
                  isSelected
                    ? { background: "#C0392B", borderColor: "#C0392B", color: "#fff5ea" }
                    : { background: "#211712", borderColor: "#3a2b1f", color: "#a88f78" }
                }
              >
                {isSelected && <span>✓</span>}
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-8">
        <div className="text-sm font-bold text-[#a88f78] uppercase tracking-wide mb-2">
          {serviceType === "🍽️ Sur place" ? "Numéro de table" : "Ton nom (pour t'appeler)"}
        </div>
        <input
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          placeholder={serviceType === "🍽️ Sur place" ? "Ex. 12" : "Ex. Julie"}
          className="w-full rounded-xl px-4 py-4 text-lg outline-none"
          style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
        />
      </div>

      <div className="flex items-center justify-between mb-4">
        <span className="text-xl font-bold">Total</span>
        <span className="display-font text-3xl font-bold text-[#E8B23D]">{eur(total)}</span>
      </div>
      <button onClick={onConfirm} disabled={cart.length === 0} className="tap-scale rounded-full py-6 text-2xl font-bold disabled:opacity-40" style={{ background: "#C0392B", color: "#fff5ea" }}>
        {pizzaCount > 0 ? "Choisir mon créneau →" : "Valider ma commande →"}
      </button>
      <p className="text-center text-[#8a7561] text-sm mt-4">Le règlement se fait en caisse, après validation.</p>
    </div>
  );
}

function SlotScreen({ pizzaCount, slotChoice, selectedSlot, setSelectedSlot, allSlotsConfigured, onBack, onConfirm }) {
  const [showAll, setShowAll] = useState(false);
  const mode = slotChoice?.mode;

  useEffect(() => {
    if (mode === "single" && slotChoice.options.length > 0 && !selectedSlot) {
      setSelectedSlot(slotChoice.options[0]);
    }
  }, [slotChoice]); // eslint-disable-line react-hooks/exhaustive-deps

  const options = mode === "single" ? slotChoice.options : [];
  const earliest = options[0];
  const laterOptions = options.slice(1);
  const canConfirm = mode === "split" || (mode === "single" && selectedSlot);

  return (
    <div className="flex-1 flex flex-col px-6 py-6">
      <button onClick={onBack} className="text-[#c9b8a4] text-sm font-semibold mb-6 self-start tap-scale">← Retour</button>
      <h2 className="display-font text-3xl font-semibold mb-2">Ton créneau</h2>
      <p className="text-[#a88f78] mb-8">{pizzaCount} pizza{pizzaCount > 1 ? "s" : ""} dans ta commande — on t'affiche uniquement les horaires où le four a la place.</p>

      {!allSlotsConfigured && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <span className="text-5xl mb-4">🧑‍🍳</span>
          <p className="text-[#c9b8a4]">L'équipe n'a pas encore ouvert les créneaux du service.</p>
          <p className="text-[#8a7561] text-sm mt-2">Adresse-toi directement à un membre de l'équipe.</p>
        </div>
      )}

      {allSlotsConfigured && mode === "none" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <span className="text-5xl mb-4">😕</span>
          <p className="text-[#c9b8a4]">Même en répartissant sur plusieurs créneaux, le four n'a pas la place pour {pizzaCount} pizza{pizzaCount > 1 ? "s" : ""} aujourd'hui.</p>
          <p className="text-[#8a7561] text-sm mt-2">Réduis le nombre de pizzas, ou adresse-toi directement à l'équipe.</p>
        </div>
      )}

      {allSlotsConfigured && mode === "single" && earliest && !showAll && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <span className="text-sm font-bold uppercase tracking-wide text-[#a88f78] mb-3">Créneau le plus proche</span>
          <div className="rounded-3xl border-2 border-[#C0392B] bg-[#2c1c14] px-14 py-10 mb-6">
            <div className="display-font text-6xl font-bold">{earliest.label}</div>
            <div className="text-[#a88f78] mt-2">{earliest.remaining} place{earliest.remaining > 1 ? "s" : ""} disponible{earliest.remaining > 1 ? "s" : ""}</div>
          </div>
          {laterOptions.length > 0 && (
            <button onClick={() => setShowAll(true)} className="text-[#c9b8a4] font-semibold underline underline-offset-4 tap-scale">
              Choisir un créneau plus tard
            </button>
          )}
        </div>
      )}

      {allSlotsConfigured && mode === "single" && showAll && (
        <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-3 content-start">
          {options.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSlot(s)}
              className={`tap-scale rounded-2xl py-5 border-2 flex flex-col items-center ${selectedSlot?.id === s.id ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f] bg-[#211712]"}`}
            >
              <span className="display-font text-2xl font-bold">{s.label}</span>
              <span className="text-[#a88f78] text-xs mt-1">{s.remaining} place{s.remaining > 1 ? "s" : ""} dispo</span>
            </button>
          ))}
        </div>
      )}

      {allSlotsConfigured && mode === "split" && (
        <div className="flex-1 flex flex-col justify-center">
          <span className="text-sm font-bold uppercase tracking-wide text-[#a88f78] mb-4 text-center">
            Grosse commande — ton four préfère l'étaler en {slotChoice.plan.length} fournées
          </span>
          <div className="flex flex-col gap-4">
            {slotChoice.plan.map((p, idx) => (
              <div key={p.slotId} className="rounded-2xl border-2 border-[#C0392B] bg-[#2c1c14] px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="w-8 h-8 rounded-full bg-[#C0392B] text-[#fff5ea] font-bold flex items-center justify-center text-sm">{idx + 1}</span>
                  <span className="display-font text-3xl font-bold">{p.label}</span>
                </div>
                <span className="text-[#E8B23D] font-bold">{p.qty} pizza{p.qty > 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-[#8a7561] text-sm mt-6">Une seule commande, sortie du four en {slotChoice.plan.length} temps — normal pour un grand groupe.</p>
        </div>
      )}

      {allSlotsConfigured && canConfirm && (
        <button onClick={onConfirm} className="tap-scale rounded-full py-6 text-2xl font-bold mt-6" style={{ background: "#C0392B", color: "#fff5ea" }}>
          {mode === "split" ? `Valider mes ${slotChoice.plan.length} fournées` : `Valider pour ${selectedSlot ? selectedSlot.label : "…"}`}
        </button>
      )}
    </div>
  );
}

function StatusScreen({ title, subtitle, success, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 6000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      {success && <span className="text-7xl mb-6">✅</span>}
      <h2 className="display-font text-4xl font-semibold mb-4">{title}</h2>
      <p className="text-[#c9b8a4] text-lg max-w-md">{subtitle}</p>
    </div>
  );
}

// ---------------- ESPACE ÉQUIPE ----------------

function PinScreen({ onSuccess, onCancel }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const [pressed, setPressed] = useState(null);

  function press(d) {
    setPressed(d);
    setTimeout(() => setPressed(null), 200);
    const next = (pin + d).slice(0, 4);
    setPin(next);
    setErr(false);
    if (next.length === 4) {
      if (next === TEAM_PIN) setTimeout(onSuccess, 150);
      else setTimeout(() => { setErr(true); setPin(""); }, 300);
    }
  }
  return (
    <div className="kiosk-root">
      <style>{`.kiosk-root { font-family:'Manrope',sans-serif; background:#1a120b; color:#f5ebdd; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; }`}</style>
      <p className="text-[#a88f78] mb-4 uppercase text-sm tracking-wide font-bold">Code équipe</p>
      <div className="flex gap-4 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`w-5 h-5 rounded-full border-2 ${pin.length > i ? "bg-[#C0392B] border-[#C0392B]" : "border-[#4a3826]"} ${err ? "border-red-500" : ""}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "←"].map((d, i) => (
          <button
            key={i}
            onClick={() => (d === "←" ? setPin(pin.slice(0, -1)) : d !== "" ? press(String(d)) : null)}
            className="w-20 h-20 rounded-full text-2xl font-bold transition-all duration-100"
            style={
              pressed === String(d)
                ? { background: "#C0392B", borderColor: "#C0392B", color: "#fff5ea", transform: "scale(0.92)" }
                : { background: "#241811", border: "1px solid #3a2b1f" }
            }
          >
            {d}
          </button>
        ))}
      </div>
      <button onClick={onCancel} className="mt-10 text-[#8a7561] text-sm tap-scale">Retour à la borne</button>
    </div>
  );
}

function TeamSpace({ slots, setSlots, orders, setOrders, ruptures, setRuptures, dessertStock, setDessertStock, customMenuItems, setCustomMenuItems, tablePlan, setTablePlan, onExit }) {
  const [zone, setZone] = useState(null); // null | "cuisine" | "salle" | "logistique"
  const [tab, setTab] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [schedulingNew, setSchedulingNew] = useState(false);

  function goZone(z, defaultTab) {
    setZone(z);
    setTab(defaultTab);
  }

  async function refreshAll() {
    setRefreshing(true);
    const [o, s, r, d] = await Promise.all([loadOrders(), loadSlots(), loadRuptures(), loadDessertStock()]);
    setOrders(o);
    setSlots(s);
    setRuptures(r);
    setDessertStock(d);
    setRefreshing(false);
  }

  const zoneLabels = { cuisine: " · En cuisine", salle: " · En salle", logistique: " · Logistique service" };

  return (
    <div className="kiosk-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,700&family=Manrope:wght@500;600;700;800&display=swap');
        .kiosk-root { font-family:'Manrope',sans-serif; background:#140d08; color:#f5ebdd; min-height:100vh; display:flex; flex-direction:column; }
        .display-font { font-family:'Fraunces',serif; }
        .tap-scale { transition: transform 0.08s ease, filter 0.08s ease, box-shadow 0.08s ease; }
        .tap-scale:active { transform: scale(0.93); filter: brightness(1.25); box-shadow: 0 0 0 3px rgba(232,178,61,0.5) inset; }
      `}</style>
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a2b1f]">
        <div className="flex items-center gap-3">
          {zone && (
            <button onClick={() => setZone(null)} className="text-[#c9b8a4] text-sm font-semibold tap-scale">← Zones</button>
          )}
          <span className="display-font text-xl font-semibold">🧑‍🍳 Espace équipe{zone ? zoneLabels[zone] : ""}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={refreshAll} disabled={refreshing} className="tap-scale text-sm font-semibold px-4 py-2 rounded-full border border-[#4a3826] disabled:opacity-50">
            {refreshing ? "…" : "🔄 Actualiser"}
          </button>
          <button onClick={onExit} className="text-[#c9b8a4] text-sm font-semibold px-4 py-2 rounded-full border border-[#4a3826] tap-scale">Fermer</button>
        </div>
      </div>

      {!zone && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
          <button onClick={() => goZone("cuisine", "kitchen")} className="tap-scale w-full max-w-md rounded-3xl border-2 border-[#3a2b1f] bg-[#211712] px-8 py-10 flex flex-col items-center gap-2">
            <span className="text-5xl mb-2">🧑‍🍳</span>
            <span className="display-font text-3xl font-bold">En cuisine</span>
            <span className="text-[#a88f78]">Four · Finition · Boissons</span>
          </button>
          <button onClick={() => goZone("salle", "staff-order")} className="tap-scale w-full max-w-md rounded-3xl border-2 border-[#3a2b1f] bg-[#211712] px-8 py-10 flex flex-col items-center gap-2">
            <span className="text-5xl mb-2">🍽️</span>
            <span className="display-font text-3xl font-bold">En salle</span>
            <span className="text-[#a88f78]">Prise de commande · Service · Caisse</span>
          </button>
          <button onClick={() => goZone("logistique", "slots")} className="tap-scale w-full max-w-md rounded-3xl border-2 border-[#3a2b1f] bg-[#211712] px-8 py-10 flex flex-col items-center gap-2">
            <span className="text-5xl mb-2">🛠️</span>
            <span className="display-font text-3xl font-bold">Logistique service</span>
            <span className="text-[#a88f78]">Créneaux du jour · Ruptures</span>
          </button>
        </div>
      )}

      {zone === "cuisine" && (
        <>
          <div className="flex gap-3 px-6 py-4 overflow-x-auto">
            <button onClick={() => setTab("kitchen")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "kitchen" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🔥 Four</button>
            <button onClick={() => setTab("finition")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "finition" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🥗 Finition</button>
            <button onClick={() => setTab("boisson")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "boisson" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🥤 Boissons</button>
          </div>
          {tab === "kitchen" && <KitchenBoard orders={orders} setOrders={setOrders} />}
          {tab === "finition" && <FinitionBoard orders={orders} setOrders={setOrders} />}
          {tab === "boisson" && <BoissonBoard orders={orders} />}
        </>
      )}

      {zone === "salle" && (
        <>
          <div className="flex gap-3 px-6 py-4 overflow-x-auto">
            <button onClick={() => setTab("staff-order")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "staff-order" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>📞 Prise de commande</button>
            <button onClick={() => setTab("service")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "service" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🍽️ Service</button>
            <button onClick={() => setTab("caisse")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "caisse" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>💰 Caisse</button>
            <button onClick={() => { setTab("scheduled"); setSchedulingNew(false); }} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "scheduled" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>📅 Programmées</button>
          </div>
          {tab === "staff-order" && <StaffOrderFlow slots={slots} orders={orders} setOrders={setOrders} ruptures={ruptures} dessertStock={dessertStock} customMenuItems={customMenuItems} />}
          {tab === "service" && <ServiceBoard orders={orders} setOrders={setOrders} />}
          {tab === "caisse" && <CaisseBoard orders={orders} setOrders={setOrders} />}
          {tab === "scheduled" && !schedulingNew && <ScheduledOrdersList orders={orders} onNew={() => setSchedulingNew(true)} />}
          {tab === "scheduled" && schedulingNew && (
            <ScheduledOrderFlow orders={orders} setOrders={setOrders} ruptures={ruptures} customMenuItems={customMenuItems} onDone={() => setSchedulingNew(false)} />
          )}
        </>
      )}

      {zone === "logistique" && (
        <>
          <div className="flex gap-3 px-6 py-4 overflow-x-auto">
            <button onClick={() => setTab("slots")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "slots" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>⏱️ Créneaux du jour</button>
            <button onClick={() => setTab("ruptures")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "ruptures" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🚫 Ruptures</button>
            <button onClick={() => setTab("desserts")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "desserts" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🍰 Desserts du jour</button>
            <button onClick={() => setTab("newproduct")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "newproduct" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>➕ Nouveau produit</button>
            <button onClick={() => setTab("maintenance")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "maintenance" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🗑️ Maintenance</button>
            <button onClick={() => setTab("tables")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "tables" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🪑 Plan de table</button>
          </div>
          {tab === "slots" && <SlotsAdmin slots={slots} setSlots={setSlots} />}
          {tab === "ruptures" && <RupturesAdmin ruptures={ruptures} setRuptures={setRuptures} />}
          {tab === "desserts" && <DessertStockAdmin orders={orders} dessertStock={dessertStock} setDessertStock={setDessertStock} />}
          {tab === "newproduct" && <NewProductAdmin customMenuItems={customMenuItems} setCustomMenuItems={setCustomMenuItems} />}
          {tab === "maintenance" && <MaintenanceAdmin orders={orders} setOrders={setOrders} />}
          {tab === "tables" && <TablePlanAdmin plan={tablePlan} setPlan={setTablePlan} />}
        </>
      )}
    </div>
  );
}

function KitchenBoard({ orders, setOrders }) {
  const active = orders.filter((o) => o.status !== "servie" && isOrderActiveToday(o));
  const aperoWaiting = active.filter((o) => o.aperoStatus === "waiting");
  const cols = [
    { key: "attente", label: "🔴 En attente" },
    { key: "preparation", label: "🟠 Enfournée" },
  ];

  function advance(order) {
    const next = order.status === "attente" ? "preparation" : "prete";
    setOrders(orders.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
  }
  function markAperoServed(order) {
    setOrders(orders.map((o) => (o.id === order.id ? { ...o, aperoStatus: "served_by_kitchen" } : o)));
  }

  // Une commande normale (colonnes En attente / Enfournée) doit avoir des pizzas "hors apéro" à faire,
  // et ne pas être en train d'attendre son apéro.
  function normalPizzaItems(o) {
    return o.items.filter((it) => (it.cat === "pizza" || it.cat === "supplement" || it.cat === "sans") && it.phase !== "apero");
  }
  function isNormalQueueOrder(o) {
    return !["waiting", "served_by_kitchen"].includes(o.aperoStatus) && normalPizzaItems(o).length > 0;
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {aperoWaiting.length > 0 && (
        <div className="mb-6">
          <div className="font-bold mb-3">🍸 Apéro à préparer ({aperoWaiting.length})</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sortOrdersByTime(aperoWaiting).map((o) => {
              const aperoItems = o.items.filter((it) => (it.cat === "pizza" || it.cat === "supplement" || it.cat === "sans") && it.phase === "apero");
              return (
                <div key={o.id} className="rounded-xl border-2 p-4" style={{ borderColor: "#C0392B", background: "#2c1c14" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "#4a2c14", color: "#E8B23D" }}>⏳ Attente apéro</span>
                  </div>
                  <div className="display-font text-xl font-bold mb-2">{o.name}</div>
                  <ul className="text-sm text-[#c9b8a4] mb-3">
                    {aperoItems.map((it, idx) => (
                      <ItemLine key={idx} it={it} />
                    ))}
                  </ul>
                  <button onClick={() => markAperoServed(o)} className="tap-scale w-full rounded-xl py-4 text-lg font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
                    ✅ Apéro servi
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-4">
        {cols.map((c) => {
          const list = sortOrdersByTime(active.filter((o) => o.status === c.key && isNormalQueueOrder(o)));
          return (
            <div key={c.key} className="min-w-[280px] flex-1">
              <div className="font-bold mb-3">{c.label} ({list.length})</div>
              <div className="flex flex-col gap-3">
                {list.map((o) => (
                  <div key={o.id} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="text-xs font-bold rounded-full px-3 py-1"
                        style={
                          o.serviceType === "🍽️ Sur place"
                            ? { background: "#2c3e50", color: "#a8c8e8" }
                            : { background: "#4a2c3e", color: "#e8a8c8" }
                        }
                      >
                        {o.serviceType}
                      </span>
                      {o.slotAllocations && o.slotAllocations.length > 0 && (
                        <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "#2c1c14", color: "#E8B23D" }}>
                          🕐 {o.slotAllocations.map((a) => `${a.qty}×${a.label}`).join(" + ")}
                        </span>
                      )}
                    </div>
                    <div className="display-font text-xl font-bold mb-2">{o.name}</div>
                    <ul className="text-sm text-[#c9b8a4] mb-3">
                      {normalPizzaItems(o).map((it, idx) => (
                        <ItemLine key={idx} it={it} />
                      ))}
                    </ul>
                    <div className="display-font font-bold text-[#E8B23D] mb-3">{eur(o.total)}</div>
                    {o.status !== "prete" && (
                      <button onClick={() => advance(o)} className="tap-scale w-full rounded-xl py-4 text-lg font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
                        {o.status === "attente" ? "🔥 Enfourner" : "✅ Sortie du four"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function orderSortMinutes(order) {
  if (order.slotAllocations && order.slotAllocations.length > 0) {
    const mins = order.slotAllocations.map((a) => parseMinutes(a.label)).filter((m) => m !== null);
    if (mins.length > 0) return Math.min(...mins);
  }
  if (order.scheduledTime) {
    const mins = parseMinutes(order.scheduledTime);
    if (mins !== null) return mins;
  }
  return 24 * 60 + (order.createdAt % (24 * 60 * 60000)) / 60000; // pas de créneau → tout en bas, ordre de création
}
function sortOrdersByTime(list) {
  return [...list].sort((a, b) => orderSortMinutes(a) - orderSortMinutes(b));
}

function ItemLine({ it }) {
  return (
    <li className="mb-1.5">
      <div>{it.qty}× {it.name}</div>
      {it.note && (
        <div className="text-xs text-[#E8B23D] pl-4">↳ {flavorConfigFor(it.name)?.icon || "🍨"} {it.note}</div>
      )}
      {(it.modifiers || []).map((m, mi) => (
        <div key={mi} className="text-xs text-[#a88f78] pl-4">
          ↳ {m.name}
        </div>
      ))}
    </li>
  );
}

function OrderCardHeader({ order }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span
        className="text-xs font-bold rounded-full px-3 py-1"
        style={
          order.serviceType === "🍽️ Sur place"
            ? { background: "#2c3e50", color: "#a8c8e8" }
            : { background: "#4a2c3e", color: "#e8a8c8" }
        }
      >
        {order.serviceType}
      </span>
      {order.slotAllocations && order.slotAllocations.length > 0 ? (
        <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "#2c1c14", color: "#E8B23D" }}>
          🕐 {order.slotAllocations.map((a) => `${a.qty}×${a.label}`).join(" + ")}
        </span>
      ) : order.scheduledTime ? (
        <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "#2c1c14", color: "#E8B23D" }}>
          🕐 {order.scheduledTime}
        </span>
      ) : null}
    </div>
  );
}

function FinitionBoard({ orders, setOrders }) {
  const active = orders.filter((o) => o.status !== "servie" && isOrderActiveToday(o));
  // Concerné par Finition : les planches/salades (dès la prise de commande) ET les commandes
  // qui viennent de sortir du four (garniture après-cuisson) ou qui n'ont pas de pizza du tout.
  const toHandle = active.filter((o) => {
    const hasPrep = o.items.some((it) => it.cat === "antipasti" || it.cat === "salade");
    const needsGarnish = o.status === "prete";
    const noPizzaAtAll = o.pizzaCount === 0 && o.status !== "pret_service";
    return hasPrep || needsGarnish || noPizzaAtAll;
  });

  function markDone(order) {
    setOrders(orders.map((o) => (o.id === order.id ? { ...o, status: "pret_service" } : o)));
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <p className="text-[#a88f78] mb-4 text-sm">Planches, salades et garniture après-cuisson des pizzas — dès qu'elles sortent du four.</p>
      {toHandle.length === 0 && <p className="text-[#8a7561]">Rien à préparer pour l'instant.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sortOrdersByTime(toHandle).map((o) => {
          const prepItems = o.items.filter((it) => it.cat === "antipasti" || it.cat === "salade");
          const canFinish = o.status === "prete" || o.pizzaCount === 0;
          return (
            <div key={o.id} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
              <OrderCardHeader order={o} />
              <div className="display-font text-lg font-bold mb-2">{o.name}</div>
              {prepItems.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Planches / salades</div>
                  <ul className="text-sm text-[#c9b8a4]">
                    {prepItems.map((it, idx) => (
                      <ItemLine key={idx} it={it} />
                    ))}
                  </ul>
                </div>
              )}
              {o.status === "prete" && (
                <div className="mb-2">
                  <div className="text-xs text-[#E8B23D] uppercase font-bold mb-1">🔥 Sortie du four — à garnir</div>
                  <ul className="text-sm text-[#c9b8a4]">
                    {o.items.filter((it) => it.cat === "pizza").map((it, idx) => (
                      <ItemLine key={idx} it={it} />
                    ))}
                  </ul>
                </div>
              )}
              {canFinish && (
                <button onClick={() => markDone(o)} className="tap-scale w-full rounded-xl py-3 text-sm font-bold mt-2" style={{ background: "#C0392B", color: "#fff5ea" }}>
                  ✅ Terminé → Service
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BoissonBoard({ orders }) {
  const DRINK_CATS = ["boisson", "biere", "vin", "cocktail"];
  const active = orders.filter((o) => o.status !== "servie" && isOrderActiveToday(o));
  const withDrinks = active
    .map((o) => ({ ...o, drinkItems: o.items.filter((it) => DRINK_CATS.includes(it.cat)) }))
    .filter((o) => o.drinkItems.length > 0);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <p className="text-[#a88f78] mb-4 text-sm">Boissons, bières, vins et cocktails à préparer — indépendamment de l'avancée du four. Pratique un soir de concert.</p>
      {withDrinks.length === 0 && <p className="text-[#8a7561]">Rien à préparer pour l'instant.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sortOrdersByTime(withDrinks).map((o) => (
          <div key={o.id} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
            <OrderCardHeader order={o} />
            <div className="display-font text-lg font-bold mb-2">{o.name}</div>
            <ul className="text-sm text-[#c9b8a4]">
              {o.drinkItems.map((it, idx) => (
                <ItemLine key={idx} it={it} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function ServiceBoard({ orders, setOrders }) {
  const active = orders.filter((o) => o.status !== "servie" && isOrderActiveToday(o));
  const aperoReady = active.filter((o) => o.aperoStatus === "served_by_kitchen");
  const groups = [
    { key: "pret_service", label: "🟢 Prêtes à apporter" },
    { key: "prete", label: "🟡 En finition" },
    { key: "preparation", label: "🟠 En cuisson" },
    { key: "attente", label: "🔴 Pas encore lancées" },
  ];

  function launchPizzas(order) {
    setOrders(orders.map((o) => (o.id === order.id ? { ...o, aperoStatus: "released" } : o)));
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {aperoReady.length > 0 && (
        <div className="mb-6">
          <div className="font-bold mb-3">🍸 Apéro servi — prêt à lancer les pizzas ({aperoReady.length})</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sortOrdersByTime(aperoReady).map((o) => (
              <div key={o.id} className="rounded-xl border-2 p-4" style={{ borderColor: "#C0392B", background: "#2c1c14" }}>
                <div className="display-font text-lg font-bold mb-2">{o.name}</div>
                <ul className="text-sm text-[#c9b8a4] mb-3">
                  {o.items.filter((it) => it.phase === "main").map((it, idx) => (
                    <ItemLine key={idx} it={it} />
                  ))}
                </ul>
                <button onClick={() => launchPizzas(o)} className="tap-scale w-full rounded-xl py-4 text-lg font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
                  🍕 Lancer les pizzas
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {groups.map((g) => {
        const list = active.filter((o) => o.status === g.key);
        if (list.length === 0) return null;
        return (
          <div key={g.key} className="mb-6">
            <div className="font-bold mb-3">{g.label} ({list.length})</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sortOrdersByTime(list).map((o) => (
                <div key={o.id} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
                  <OrderCardHeader order={o} />
                  <div className="display-font text-lg font-bold mb-2">{o.name}</div>
                  <ul className="text-sm text-[#c9b8a4]">
                    {o.items.map((it, idx) => (
                      <ItemLine key={idx} it={it} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CaisseBoard({ orders, setOrders }) {
  const active = orders.filter((o) => o.status !== "servie" && isOrderActiveToday(o));
  const paidToday = orders.filter((o) => o.status === "servie");
  const totalActive = active.reduce((s, o) => s + o.total, 0);
  const totalCollected = paidToday.reduce((s, o) => s + o.total, 0);
  function markPaid(order) {
    setOrders(orders.map((o) => (o.id === order.id ? { ...o, status: "servie" } : o)));
  }
  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="flex gap-4 mb-6">
        <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] px-5 py-4 flex-1">
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">À encaisser ({active.length})</div>
          <div className="display-font text-2xl font-bold">{eur(totalActive)}</div>
        </div>
        <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] px-5 py-4 flex-1">
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Déjà encaissé ({paidToday.length})</div>
          <div className="display-font text-2xl font-bold text-[#E8B23D]">{eur(totalCollected)}</div>
        </div>
      </div>
      {active.length === 0 && <p className="text-[#8a7561]">Aucune commande en attente de règlement.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sortOrdersByTime(active).map((o) => (
          <div key={o.id} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
            <OrderCardHeader order={o} />
            <div className="display-font text-lg font-bold mb-2">{o.name}</div>
            <ul className="text-sm text-[#c9b8a4] mb-3">
              {o.items.map((it, idx) => (
                <ItemLine key={idx} it={it} />
              ))}
            </ul>
            <div className="flex items-center justify-between">
              <span className="display-font font-bold text-[#E8B23D] text-lg">{eur(o.total)}</span>
              <button onClick={() => markPaid(o)} className="tap-scale text-xs font-bold rounded-full px-4 py-2" style={{ background: "#C0392B", color: "#fff5ea" }}>
                💰 Marquer payée
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StaffOrderFlow({ slots, orders, setOrders, ruptures, dessertStock, customMenuItems }) {
  const fullMenu = useMemo(() => [...MENU, ...(customMenuItems || [])], [customMenuItems]);
  const [screen, setScreen] = useState("apero-ask"); // apero-ask | order | checkout | slot | done
  const [activeCat, setActiveCat] = useState("boisson");
  const [cart, setCart] = useState([]);
  const [serviceType, setServiceType] = useState("🍽️ Sur place");
  const [tableName, setTableName] = useState("");
  const [customizing, setCustomizing] = useState(null);
  const [flavoring, setFlavoring] = useState(null);
  const [slotChoice, setSlotChoice] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [aperoMode, setAperoMode] = useState(false); // vrai pendant la sélection de l'apéro
  const [aperoUsed, setAperoUsed] = useState(false); // vrai si cette commande a démarré par un apéro

  const total = useMemo(() => cart.reduce((s, i) => s + lineUnitPrice(i) * i.qty, 0), [cart]);
  const itemCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);
  const pizzaCount = useMemo(() => cart.filter((i) => i.cat === "pizza").reduce((s, i) => s + i.qty, 0), [cart]);

  function addItem(item, note) {
    const phase = aperoMode ? "apero" : aperoUsed ? "main" : undefined;
    setCart((prev) => {
      const sig = cartSignature(item.id, note, null) + "|" + (phase || "");
      const existing = prev.find((i) => cartSignature(i.id, i.note, i.modifiers) + "|" + (i.phase || "") === sig);
      let next = existing
        ? prev.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i))
        : [...prev, { ...item, qty: 1, note: note || null, modifiers: [], phase }];
      return withAutoFocaccia(next, item, phase);
    });
  }
  function addCustomizedPizza(pizzaItem, removedItems, addedItems) {
    const phase = aperoMode ? "apero" : aperoUsed ? "main" : undefined;
    const modifiers = [
      ...removedItems.map((i) => ({ name: i.name, price: i.price })),
      ...addedItems.map((i) => ({ name: i.name, price: i.price })),
    ];
    setCart((prev) => {
      const sig = cartSignature(pizzaItem.id, null, modifiers) + "|" + (phase || "");
      const existing = prev.find((i) => cartSignature(i.id, i.note, i.modifiers) + "|" + (i.phase || "") === sig);
      if (existing) return prev.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { ...pizzaItem, qty: 1, note: null, modifiers, phase }];
    });
    setCustomizing(null);
  }
  function changeQty(id, note, modifiers, delta) {
    const sig = cartSignature(id, note, modifiers);
    setCart((prev) => prev.map((i) => (cartSignature(i.id, i.note, i.modifiers) === sig ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0));
  }
  function resetAll() {
    setCart([]);
    setTableName("");
    setServiceType("🍽️ Sur place");
    setActiveCat("boisson");
    setSlotChoice(null);
    setSelectedSlot(null);
    setAperoMode(false);
    setAperoUsed(false);
    setScreen("apero-ask");
  }

  function submitOrder(finalPlan) {
    const hasMainPizza = cart.some((i) => i.cat === "pizza" && i.phase === "main");
    const newOrder = {
      id: nextId("o"),
      items: cart.map(({ id, name, price, cat, qty, note, phase, modifiers }) => ({ id, name, price, cat, qty, note, phase, modifiers })),
      serviceType,
      name: tableName || "Commande équipe",
      slotAllocations: finalPlan || [],
      pizzaCount,
      total,
      status: "attente",
      aperoStatus: aperoUsed && hasMainPizza ? "waiting" : null,
      createdAt: Date.now(),
    };
    const merged = [...orders, newOrder];
    setOrders(merged);
    setScreen("done");
    const trySave = (attempt) => {
      saveOrders(merged).catch((err) => {
        if (attempt < 3) setTimeout(() => trySave(attempt + 1), 400);
        else console.error("Échec définitif de l'enregistrement de la commande", err);
      });
    };
    trySave(1);
  }

  function goToSlot() {
    if (pizzaCount === 0) {
      submitOrder(null);
      return;
    }
    setSelectedSlot(null);
    setSlotChoice(computeSlotOptions(orders, slots, pizzaCount));
    setScreen("slot");
  }

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      {screen === "apero-ask" && (
        <AperoAskScreen
          onAnswer={(wantsApero) => {
            if (wantsApero) {
              setAperoMode(true);
              setAperoUsed(true);
              setActiveCat("boisson");
            } else {
              setAperoMode(false);
              setAperoUsed(false);
              setActiveCat("pizza");
            }
            setScreen("order");
          }}
        />
      )}

      {screen === "order" && (
        <OrderScreen
          activeCat={activeCat}
          setActiveCat={setActiveCat}
          cart={cart}
          addItem={addItem}
          onPizzaTap={setCustomizing}
          onGlaceTap={setFlavoring}
          changeQty={changeQty}
          total={total}
          itemCount={itemCount}
          onCancel={resetAll}
          onCheckout={() => setScreen("checkout")}
          aperoMode={aperoMode}
          ruptures={ruptures}
          orders={orders}
          dessertStock={dessertStock}
          menu={fullMenu}
          onFinishApero={() => {
            setAperoMode(false);
            setActiveCat("pizza");
          }}
        />
      )}

      {screen === "checkout" && (
        <CheckoutScreen
          cart={cart}
          changeQty={changeQty}
          total={total}
          pizzaCount={pizzaCount}
          serviceType={serviceType}
          setServiceType={setServiceType}
          tableName={tableName}
          setTableName={setTableName}
          onBack={() => setScreen("order")}
          onConfirm={goToSlot}
        />
      )}

      {screen === "slot" && (
        <SlotScreen
          pizzaCount={pizzaCount}
          slotChoice={slotChoice}
          selectedSlot={selectedSlot}
          setSelectedSlot={setSelectedSlot}
          allSlotsConfigured={slots.length > 0}
          onBack={() => setScreen("checkout")}
          onConfirm={() => {
            const finalPlan =
              slotChoice.mode === "split"
                ? slotChoice.plan
                : selectedSlot
                ? [{ slotId: selectedSlot.id, label: selectedSlot.label, qty: pizzaCount }]
                : null;
            submitOrder(finalPlan);
          }}
        />
      )}

      {screen === "done" && <StatusScreen title="Commande enregistrée !" subtitle="Elle est partie en cuisine." success onDone={resetAll} />}

      {customizing && (
        <PizzaCustomizeModal pizza={customizing} onClose={() => setCustomizing(null)} onConfirm={(r, a) => addCustomizedPizza(customizing, r, a)} />
      )}
      {flavoring && (
        <FlavorModal
          item={flavoring}
          onClose={() => setFlavoring(null)}
          onConfirm={(note) => {
            addItem(flavoring, note);
            setFlavoring(null);
          }}
        />
      )}
    </div>
  );
}

function ScheduledOrdersList({ orders, onNew }) {
  const upcoming = orders.filter((o) => o.status !== "servie" && isOrderScheduledLater(o)).sort((a, b) => (a.scheduledFor < b.scheduledFor ? -1 : 1));

  const byDate = {};
  upcoming.forEach((o) => {
    byDate[o.scheduledFor] = byDate[o.scheduledFor] || [];
    byDate[o.scheduledFor].push(o);
  });

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <button onClick={onNew} className="tap-scale w-full rounded-2xl py-5 text-xl font-bold mb-6" style={{ background: "#C0392B", color: "#fff5ea" }}>
        + Nouvelle commande à programmer
      </button>

      {upcoming.length === 0 && <p className="text-[#8a7561]">Aucune commande programmée pour un autre jour.</p>}

      {Object.keys(byDate).map((date) => (
        <div key={date} className="mb-6">
          <div className="font-bold mb-3 capitalize">📅 {formatFrenchDate(date)} ({byDate[date].length})</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {byDate[date].sort((a, b) => (a.scheduledTime || "").localeCompare(b.scheduledTime || "")).map((o) => (
              <div key={o.id} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
                <OrderCardHeader order={o} />
                <div className="display-font text-lg font-bold mb-2">{o.name}</div>
                <ul className="text-sm text-[#c9b8a4]">
                  {o.items.map((it, idx) => (
                    <ItemLine key={idx} it={it} />
                  ))}
                </ul>
                <div className="display-font font-bold text-[#E8B23D] mt-2">{eur(o.total)}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="text-[#5a4a3a] text-xs mt-4">Ces commandes basculent automatiquement dans les écrans normaux (Four, Finition, Service...) le jour même, sans rien à faire.</p>
    </div>
  );
}

function ScheduledOrderFlow({ orders, setOrders, ruptures, customMenuItems, onDone }) {
  const fullMenu = useMemo(() => [...MENU, ...(customMenuItems || [])], [customMenuItems]);
  const [screen, setScreen] = useState("date"); // date | order | checkout | done
  const [scheduledFor, setScheduledFor] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [activeCat, setActiveCat] = useState("pizza");
  const [cart, setCart] = useState([]);
  const [serviceType, setServiceType] = useState("🍽️ Sur place");
  const [tableName, setTableName] = useState("");
  const [customizing, setCustomizing] = useState(null);
  const [flavoring, setFlavoring] = useState(null);

  const total = useMemo(() => cart.reduce((s, i) => s + lineUnitPrice(i) * i.qty, 0), [cart]);
  const itemCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);
  const pizzaCount = useMemo(() => cart.filter((i) => i.cat === "pizza").reduce((s, i) => s + i.qty, 0), [cart]);

  function addItem(item, note) {
    setCart((prev) => {
      const existing = prev.find((i) => cartSignature(i.id, i.note, i.modifiers) === cartSignature(item.id, note, null));
      let next = existing
        ? prev.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i))
        : [...prev, { ...item, qty: 1, note: note || null, modifiers: [] }];
      return withAutoFocaccia(next, item);
    });
  }
  function addCustomizedPizza(pizzaItem, removedItems, addedItems) {
    const modifiers = [
      ...removedItems.map((i) => ({ name: i.name, price: i.price })),
      ...addedItems.map((i) => ({ name: i.name, price: i.price })),
    ];
    setCart((prev) => {
      const sig = cartSignature(pizzaItem.id, null, modifiers);
      const existing = prev.find((i) => cartSignature(i.id, i.note, i.modifiers) === sig);
      if (existing) return prev.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { ...pizzaItem, qty: 1, note: null, modifiers }];
    });
    setCustomizing(null);
  }
  function changeQty(id, note, modifiers, delta) {
    const sig = cartSignature(id, note, modifiers);
    setCart((prev) => prev.map((i) => (cartSignature(i.id, i.note, i.modifiers) === sig ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0));
  }

  function submitOrder() {
    const newOrder = {
      id: nextId("o"),
      items: cart.map(({ id, name, price, cat, qty, note, modifiers }) => ({ id, name, price, cat, qty, note, modifiers })),
      serviceType,
      name: tableName || "Commande programmée",
      slotAllocations: [],
      pizzaCount,
      total,
      status: "attente",
      scheduledFor,
      scheduledTime,
      createdAt: Date.now(),
    };
    const merged = [...orders, newOrder];
    setOrders(merged);
    setScreen("done");
    const trySave = (attempt) => {
      saveOrders(merged).catch((err) => {
        if (attempt < 3) setTimeout(() => trySave(attempt + 1), 400);
        else console.error("Échec définitif de l'enregistrement de la commande programmée", err);
      });
    };
    trySave(1);
  }

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      {screen === "date" && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <span className="text-6xl mb-6">📅</span>
          <h2 className="display-font text-3xl font-semibold mb-6">Pour quel jour ?</h2>
          <input
            type="date"
            value={scheduledFor}
            min={todayStr()}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="rounded-xl px-4 py-4 text-lg mb-4"
            style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
          />
          <div className="text-sm text-[#a88f78] uppercase font-bold mb-2">À quelle heure ?</div>
          <input
            type="time"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            className="rounded-xl px-4 py-4 text-lg mb-8"
            style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
          />
          <div className="flex gap-4">
            <button onClick={onDone} className="tap-scale rounded-full px-8 py-4 font-bold border-2 border-[#3a2b1f]">Annuler</button>
            <button
              onClick={() => setScreen("order")}
              disabled={!scheduledFor || !scheduledTime}
              className="tap-scale rounded-full px-8 py-4 font-bold disabled:opacity-40"
              style={{ background: "#C0392B", color: "#fff5ea" }}
            >
              Continuer →
            </button>
          </div>
        </div>
      )}

      {screen === "order" && (
        <OrderScreen
          activeCat={activeCat}
          setActiveCat={setActiveCat}
          cart={cart}
          addItem={addItem}
          onPizzaTap={setCustomizing}
          onGlaceTap={setFlavoring}
          changeQty={changeQty}
          total={total}
          itemCount={itemCount}
          onCancel={onDone}
          onCheckout={() => setScreen("checkout")}
          aperoMode={false}
          ruptures={ruptures}
          orders={orders}
          dessertStock={{}}
          menu={fullMenu}
          onFinishApero={() => {}}
        />
      )}

      {screen === "checkout" && (
        <CheckoutScreen
          cart={cart}
          changeQty={changeQty}
          total={total}
          pizzaCount={0}
          serviceType={serviceType}
          setServiceType={setServiceType}
          tableName={tableName}
          setTableName={setTableName}
          onBack={() => setScreen("order")}
          onConfirm={submitOrder}
        />
      )}

      {screen === "done" && (
        <StatusScreen title="Commande programmée !" subtitle={`Elle basculera automatiquement le ${formatFrenchDate(scheduledFor)} à ${scheduledTime}.`} success onDone={onDone} />
      )}

      {customizing && (
        <PizzaCustomizeModal pizza={customizing} onClose={() => setCustomizing(null)} onConfirm={(r, a) => addCustomizedPizza(customizing, r, a)} />
      )}
      {flavoring && (
        <FlavorModal
          item={flavoring}
          onClose={() => setFlavoring(null)}
          onConfirm={(note) => {
            addItem(flavoring, note);
            setFlavoring(null);
          }}
        />
      )}
    </div>
  );
}

function RupturesAdmin({ ruptures, setRuptures }) {
  const [cat, setCat] = useState("pizza");
  const items = MENU.filter((m) => m.cat === cat);

  function toggle(id) {
    if (ruptures.includes(id)) setRuptures(ruptures.filter((r) => r !== id));
    else setRuptures([...ruptures, id]);
  }

  const rupturedItems = MENU.filter((m) => ruptures.includes(m.id));

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {rupturedItems.length > 0 && (
        <div className="rounded-xl mb-6 px-5 py-4" style={{ background: "#2c1c14", border: "1px solid #C0392B" }}>
          <div className="font-bold mb-2">🚫 En rupture actuellement ({rupturedItems.length})</div>
          <div className="flex flex-wrap gap-2">
            {rupturedItems.map((it) => (
              <button key={it.id} onClick={() => toggle(it.id)} className="chip tap-scale text-sm" style={{ background: "#C0392B", borderColor: "#C0392B", color: "#fff5ea", borderRadius: 999, padding: "6px 14px", fontWeight: 700 }}>
                ✕ {it.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 mb-5 overflow-x-auto">
        {CATEGORIES.map((c) => (
          <button key={c.key} onClick={() => setCat(c.key)} className={`tap-scale shrink-0 rounded-full px-5 py-2 font-bold border-2 text-sm ${cat === c.key ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {items.map((it) => {
          const isOut = ruptures.includes(it.id);
          return (
            <button
              key={it.id}
              onClick={() => toggle(it.id)}
              className="tap-scale rounded-full px-4 py-2 font-bold border-2 text-sm"
              style={isOut ? { background: "#C0392B", borderColor: "#C0392B", color: "#fff5ea" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
            >
              {isOut ? "🚫 " : ""}{it.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DessertStockAdmin({ orders, dessertStock, setDessertStock }) {
  const [inputs, setInputs] = useState(() =>
    Object.fromEntries(DESSERT_STOCK_GROUPS.map((g) => [g.key, String(dessertStock[g.key] ?? "")]))
  );

  function save(key) {
    const n = parseInt(inputs[key], 10);
    setDessertStock({ ...dessertStock, [key]: isNaN(n) ? 0 : n });
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <p className="text-[#a88f78] mb-6 text-sm">
        Renseigne chaque matin le nombre préparé. Dès que le stock est épuisé, le dessert disparaît automatiquement du menu — la borne et l'équipe décomptent en direct au fil des commandes.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DESSERT_STOCK_GROUPS.map((g) => {
          const remaining = remainingForDessertGroup(orders, dessertStock, g);
          return (
            <div key={g.key} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
              <div className="font-bold mb-1">{g.label}</div>
              {g.itemNames.length > 1 && <div className="text-xs text-[#8a7561] mb-3">Stock partagé : {g.itemNames.join(" + ")}</div>}
              <div className="flex items-center gap-3 mb-2">
                <input
                  value={inputs[g.key]}
                  onChange={(e) => setInputs({ ...inputs, [g.key]: e.target.value })}
                  type="number"
                  placeholder="Quantité faite"
                  className="rounded-lg px-3 py-2 w-32"
                  style={{ background: "#140d08", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
                />
                <button onClick={() => save(g.key)} className="tap-scale rounded-lg px-4 py-2 font-bold text-sm" style={{ background: "#C0392B", color: "#fff5ea" }}>
                  Enregistrer
                </button>
              </div>
              <div className={`text-sm font-bold ${remaining <= 0 ? "text-[#C0392B]" : "text-[#E8B23D]"}`}>
                {remaining <= 0 ? "🚫 Épuisé" : `${remaining} restant${remaining > 1 ? "s" : ""} aujourd'hui`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NewProductAdmin({ customMenuItems, setCustomMenuItems }) {
  const [name, setName] = useState("");
  const [cat, setCat] = useState("pizza");
  const [price, setPrice] = useState("");
  const [ingredients, setIngredients] = useState([]);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoLoading, setPhotoLoading] = useState(false);

  function toggleIngredient(n) {
    setIngredients((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  function createProduct() {
    if (!name.trim() || price === "") return;
    const newItem = {
      id: nextId("cm"),
      name: name.trim(),
      price: parseFloat(price) || 0,
      cat,
      ingredients: cat === "pizza" ? ingredients : undefined,
      photoUrl: photoUrl.trim() || null,
    };
    setCustomMenuItems([...customMenuItems, newItem]);
    setName("");
    setPrice("");
    setIngredients([]);
    setPhotoUrl("");
  }

  function removeProduct(id) {
    setCustomMenuItems(customMenuItems.filter((i) => i.id !== id));
  }

  const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="rounded-2xl border border-[#3a2b1f] p-5 mb-8">
        <div className="font-bold mb-4">Créer un nouveau produit</div>

        <div className="mb-4">
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Nom du produit</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Tartufo" className="w-full rounded-lg px-3 py-3" style={inputStyle} />
        </div>

        <div className="mb-4">
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Catégorie</div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2"
                style={cat === c.key ? { borderColor: "#C0392B", background: "#2c1c14" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Prix (€)</div>
          <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" step="0.1" placeholder="Ex. 15.5" className="w-40 rounded-lg px-3 py-3" style={inputStyle} />
        </div>

        {cat === "pizza" && (
          <div className="mb-4">
            <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Ingrédients (pour permettre "retirer un ingrédient")</div>
            <div className="flex flex-wrap gap-2">
              {INGREDIENT_NAMES.map((n) => {
                const on = ingredients.includes(n);
                return (
                  <button
                    key={n}
                    onClick={() => toggleIngredient(n)}
                    className="tap-scale rounded-full px-3 py-1.5 text-xs font-bold border-2"
                    style={on ? { borderColor: "#C0392B", background: "#2c1c14", color: "#fff5ea" } : { borderColor: "#3a2b1f", color: "#a88f78" }}
                  >
                    {on ? "✓ " : ""}{n}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-5">
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Photo (visible uniquement côté client)</div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files[0];
              if (!file) return;
              setPhotoLoading(true);
              const reader = new FileReader();
              reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                  const maxW = 800;
                  const scale = Math.min(1, maxW / img.width);
                  const canvas = document.createElement("canvas");
                  canvas.width = img.width * scale;
                  canvas.height = img.height * scale;
                  const ctx = canvas.getContext("2d");
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  setPhotoUrl(canvas.toDataURL("image/jpeg", 0.75));
                  setPhotoLoading(false);
                };
                img.src = reader.result;
              };
              reader.readAsDataURL(file);
            }}
            className="w-full rounded-lg px-3 py-3 mb-2 text-sm"
            style={inputStyle}
          />
          {photoLoading && <p className="text-xs text-[#a88f78]">Traitement de la photo…</p>}
          {photoUrl && !photoLoading && <img src={photoUrl} alt="aperçu" className="w-full h-32 object-cover rounded-lg" />}
          <div className="text-xs text-[#5a4a3a] mt-2 mb-1">Le sélecteur ci-dessus ne marche pas ? Colle un lien à la place :</div>
          <input
            value={photoUrl && photoUrl.startsWith("http") ? photoUrl : ""}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg px-3 py-3 text-sm"
            style={inputStyle}
          />
        </div>

        <button onClick={createProduct} className="tap-scale w-full rounded-xl py-4 font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
          Ajouter au menu
        </button>
      </div>

      <div className="font-bold mb-3">Produits ajoutés ({customMenuItems.length})</div>
      {customMenuItems.length === 0 && <p className="text-[#8a7561]">Aucun produit personnalisé pour l'instant.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {customMenuItems.map((item) => (
          <div key={item.id} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4 flex items-center justify-between">
            <div>
              <div className="font-bold">{item.name}</div>
              <div className="text-xs text-[#a88f78]">{CATEGORIES.find((c) => c.key === item.cat)?.label} · {eur(item.price)}{item.photoUrl ? " · 📷" : ""}</div>
            </div>
            <button onClick={() => removeProduct(item.id)} className="tap-scale text-xs text-red-400 font-bold">Supprimer</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MaintenanceAdmin({ orders, setOrders }) {
  const [confirming, setConfirming] = useState(false);
  const staleOrders = orders.filter(isOrderFromPastAndStale);
  const keptCount = orders.length - staleOrders.length;

  function clearOldOrders() {
    setOrders(orders.filter((o) => !isOrderFromPastAndStale(o)));
    setConfirming(false);
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="rounded-2xl border border-[#3a2b1f] p-5">
        <div className="font-bold mb-2">🗑️ Vider le cache des anciennes commandes</div>
        <p className="text-[#a88f78] text-sm mb-4">
          Les commandes des jours précédents (déjà passées ou déjà réglées) restent stockées indéfiniment, ce qui peut ralentir la borne avec le temps.
          Cette action supprime uniquement les commandes qui ne concernent plus ni aujourd'hui, ni une date à venir — les commandes du jour et les commandes programmées restent intactes.
        </p>

        <div className="rounded-xl bg-[#211712] px-4 py-3 mb-4 text-sm">
          <span className="text-[#E8B23D] font-bold">{staleOrders.length}</span> commande{staleOrders.length > 1 ? "s" : ""} à supprimer
          {" · "}
          <span className="text-[#c9b8a4]">{keptCount}</span> conservée{keptCount > 1 ? "s" : ""} (aujourd'hui / programmées)
        </div>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            disabled={staleOrders.length === 0}
            className="tap-scale w-full rounded-xl py-4 font-bold disabled:opacity-40"
            style={{ background: "#C0392B", color: "#fff5ea" }}
          >
            Vider le cache
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-bold text-[#E8B23D]">Confirmer la suppression définitive de {staleOrders.length} commande{staleOrders.length > 1 ? "s" : ""} ?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirming(false)} className="tap-scale flex-1 rounded-xl py-3 font-bold border-2 border-[#3a2b1f]">Annuler</button>
              <button onClick={clearOldOrders} className="tap-scale flex-1 rounded-xl py-3 font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
                Oui, supprimer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TablePlanAdmin({ plan, setPlan }) {
  const [zone, setZone] = useState("interieur");
  const [newNumber, setNewNumber] = useState("");
  const [newSeats, setNewSeats] = useState("4");
  const [dragId, setDragId] = useState(null);
  const [dragPos, setDragPos] = useState(null); // position live pendant le déplacement
  const floorRef = useRef(null);

  const savedTables = plan.currentLayout[zone] || [];
  const tables = savedTables.map((t) => (dragId === t.id && dragPos ? { ...t, x: dragPos.x, y: dragPos.y } : t));
  const isModified = JSON.stringify(plan.currentLayout[zone]) !== JSON.stringify(plan.defaultLayout[zone]);

  function addTable() {
    if (!newNumber.trim()) return;
    const table = { id: nextId("t"), number: newNumber.trim(), seats: parseInt(newSeats, 10) || 1, x: 45 + Math.random() * 10, y: 45 + Math.random() * 10 };
    setPlan({ ...plan, currentLayout: { ...plan.currentLayout, [zone]: [...savedTables, table] } });
    setNewNumber("");
  }

  function removeTable(id) {
    setPlan({ ...plan, currentLayout: { ...plan.currentLayout, [zone]: savedTables.filter((t) => t.id !== id) } });
  }

  function resetToDefault() {
    setPlan({ ...plan, currentLayout: { ...plan.currentLayout, [zone]: plan.defaultLayout[zone] } });
  }

  function saveAsDefault() {
    setPlan({ ...plan, defaultLayout: { ...plan.defaultLayout, [zone]: savedTables } });
  }

  function posFromEvent(e) {
    const rect = floorRef.current.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    const x = ((point.clientX - rect.left) / rect.width) * 100;
    const y = ((point.clientY - rect.top) / rect.height) * 100;
    return { x: Math.min(95, Math.max(5, x)), y: Math.min(92, Math.max(8, y)) };
  }

  function startDrag(e, id) {
    e.preventDefault();
    setDragId(id);
    setDragPos(posFromEvent(e));
  }
  function onFloorMove(e) {
    if (!dragId) return;
    e.preventDefault();
    setDragPos(posFromEvent(e));
  }
  function endDrag() {
    if (dragId && dragPos) {
      setPlan({
        ...plan,
        currentLayout: { ...plan.currentLayout, [zone]: savedTables.map((t) => (t.id === dragId ? { ...t, x: dragPos.x, y: dragPos.y } : t)) },
      });
    }
    setDragId(null);
    setDragPos(null);
  }

  const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="flex gap-3 mb-6">
        <button onClick={() => setZone("interieur")} className={`tap-scale flex-1 rounded-xl py-3 font-bold border-2 ${zone === "interieur" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🏠 Intérieur</button>
        <button onClick={() => setZone("exterieur")} className={`tap-scale flex-1 rounded-xl py-3 font-bold border-2 ${zone === "exterieur" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🌿 Extérieur</button>
        <button onClick={() => setZone("mangedebout")} className={`tap-scale flex-1 rounded-xl py-3 font-bold border-2 ${zone === "mangedebout" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🧍 Mange-debout</button>
      </div>

      {isModified && (
        <div className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between" style={{ background: "#2c1c14", border: "1px solid #C0392B" }}>
          <span className="text-sm font-bold text-[#E8B23D]">Disposition modifiée pour ce service</span>
          <div className="flex gap-2">
            <button onClick={resetToDefault} className="tap-scale text-xs font-bold rounded-full px-3 py-2 border-2 border-[#3a2b1f]">↩️ Revenir à la fixe</button>
            <button onClick={saveAsDefault} className="tap-scale text-xs font-bold rounded-full px-3 py-2" style={{ background: "#C0392B", color: "#fff5ea" }}>💾 Garder comme fixe</button>
          </div>
        </div>
      )}

      <p className="text-[#5a4a3a] text-xs mb-3">Glisse une table pour la repositionner. Un appui long ne supprime rien — utilise la petite croix.</p>

      <div
        ref={floorRef}
        onMouseMove={onFloorMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onTouchMove={onFloorMove}
        onTouchEnd={endDrag}
        className="relative w-full rounded-2xl mb-6 select-none"
        style={{
          height: "min(70vh, 520px)",
          background: "repeating-linear-gradient(0deg, #1a120b, #1a120b 39px, #241811 40px), repeating-linear-gradient(90deg, #1a120b, #1a120b 39px, #241811 40px)",
          border: "2px solid #3a2b1f",
          touchAction: "none",
        }}
      >
        {tables.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[#5a4a3a] text-sm">Aucune table — ajoute-en une ci-dessous</div>
        )}
        {tables.map((t) => (
          <div
            key={t.id}
            onMouseDown={(e) => startDrag(e, t.id)}
            onTouchStart={(e) => startDrag(e, t.id)}
            className="absolute flex flex-col items-center justify-center rounded-full cursor-grab active:cursor-grabbing"
            style={{
              left: `${t.x ?? 50}%`,
              top: `${t.y ?? 50}%`,
              transform: "translate(-50%, -50%)",
              width: 72,
              height: 72,
              background: dragId === t.id ? "#C0392B" : "#2c1c14",
              border: "2px solid #C0392B",
              boxShadow: dragId === t.id ? "0 8px 20px rgba(0,0,0,0.4)" : "none",
              zIndex: dragId === t.id ? 10 : 1,
            }}
          >
            <span className="display-font text-lg font-bold leading-none">{t.number}</span>
            <span className="text-[10px] text-[#a88f78] mt-0.5">{t.seats} pl.</span>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                removeTable(t.id);
              }}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-800 text-white text-xs font-bold flex items-center justify-center"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#3a2b1f] p-4">
        <div className="text-sm font-bold mb-3">+ Ajouter une table {zone === "interieur" ? "à l'intérieur" : zone === "exterieur" ? "en extérieur" : "en mange-debout"}</div>
        <div className="flex items-end gap-3">
          <div>
            <div className="text-xs text-[#a88f78] mb-1">N° table</div>
            <input value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder="Ex. 12" className="rounded-lg px-3 py-2 w-24" style={inputStyle} />
          </div>
          <div>
            <div className="text-xs text-[#a88f78] mb-1">Places</div>
            <input value={newSeats} onChange={(e) => setNewSeats(e.target.value)} type="number" className="rounded-lg px-3 py-2 w-20" style={inputStyle} />
          </div>
          <button onClick={addTable} className="tap-scale rounded-lg px-5 py-2 font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>Ajouter</button>
        </div>
      </div>

      <p className="text-[#5a4a3a] text-xs mt-4">
        La disposition fixe reste inchangée tant que tu ne tapes pas sur "💾 Garder comme fixe". Pour un gros service, ajoute/déplace/retire des tables librement, puis reviens à la disposition normale ensuite.
      </p>
    </div>
  );
}

function SlotsAdmin({ slots, setSlots }) {
  const [label, setLabel] = useState("");
  const [capacity, setCapacity] = useState("6");
  const [capMidi, setCapMidi] = useState("6");
  const [capSoir, setCapSoir] = useState("6");

  function addSlot() {
    if (!label.match(/^\d{1,2}[:h]\d{2}$/)) return;
    const clean = label.replace("h", ":");
    setSlots([...slots, { id: nextId("s"), label: clean, capacity: parseInt(capacity, 10) || 0 }]);
    setLabel("");
  }
  function removeSlot(id) {
    setSlots(slots.filter((s) => s.id !== id));
  }
  function updateCapacity(id, val) {
    setSlots(slots.map((s) => (s.id === id ? { ...s, capacity: parseInt(val, 10) || 0 } : s)));
  }
  function bulkGenerate(start, end, step, cap) {
    const out = [...slots];
    let [h, m] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    while (h < eh || (h === eh && m <= em)) {
      const label = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const existingIdx = out.findIndex((s) => s.label === label);
      if (existingIdx >= 0) out[existingIdx] = { ...out[existingIdx], capacity: cap };
      else out.push({ id: nextId("s"), label, capacity: cap });
      m += step;
      if (m >= 60) { m -= 60; h += 1; }
    }
    setSlots(out);
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="rounded-xl border border-[#3a2b1f] p-4 flex-1 min-w-[240px]">
          <div className="font-bold mb-2">☀️ Service midi (12h–14h, ttes les 10 min)</div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#a88f78]">Pizzas max / créneau</span>
            <input value={capMidi} onChange={(e) => setCapMidi(e.target.value)} type="number" className="w-16 text-center rounded-lg px-2 py-1" style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }} />
            <button onClick={() => bulkGenerate("12:00", "14:00", 10, parseInt(capMidi, 10) || 0)} className="tap-scale rounded-lg px-4 py-2 text-sm font-bold ml-auto" style={{ background: "#C0392B", color: "#fff5ea" }}>
              Générer
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-[#3a2b1f] p-4 flex-1 min-w-[240px]">
          <div className="font-bold mb-2">🌙 Service soir (18h–22h30, ttes les 10 min)</div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#a88f78]">Pizzas max / créneau</span>
            <input value={capSoir} onChange={(e) => setCapSoir(e.target.value)} type="number" className="w-16 text-center rounded-lg px-2 py-1" style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }} />
            <button onClick={() => bulkGenerate("18:00", "22:30", 10, parseInt(capSoir, 10) || 0)} className="tap-scale rounded-lg px-4 py-2 text-sm font-bold ml-auto" style={{ background: "#C0392B", color: "#fff5ea" }}>
              Générer
            </button>
          </div>
        </div>
        <button onClick={() => setSlots([])} className="tap-scale rounded-xl border border-red-800 text-red-400 px-4 py-3 text-sm font-bold self-start">Tout effacer</button>
        <button onClick={() => loadSlots().then(setSlots)} className="tap-scale rounded-xl border border-[#3a2b1f] px-4 py-3 text-sm font-bold self-start">🔄 Actualiser</button>
      </div>

      <div className="flex items-end gap-3 mb-6">
        <div>
          <div className="text-xs text-[#a88f78] mb-1">Horaire (ex 19:30)</div>
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="rounded-lg px-3 py-2 w-28" style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }} />
        </div>
        <div>
          <div className="text-xs text-[#a88f78] mb-1">Pizzas max</div>
          <input value={capacity} onChange={(e) => setCapacity(e.target.value)} type="number" className="rounded-lg px-3 py-2 w-24" style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }} />
        </div>
        <button onClick={addSlot} className="tap-scale rounded-lg px-5 py-2 font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>Ajouter</button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {slots
          .slice()
          .sort((a, b) => (parseMinutes(a.label) ?? 0) - (parseMinutes(b.label) ?? 0))
          .map((s) => (
            <div key={s.id} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-3 flex flex-col items-center">
              <span className="font-bold">{s.label}</span>
              <input
                value={s.capacity}
                onChange={(e) => updateCapacity(s.id, e.target.value)}
                type="number"
                className="w-16 text-center bg-transparent border-b border-[#3a2b1f] my-1"
              />
              <button onClick={() => removeSlot(s.id)} className="text-xs text-red-400 tap-scale">Supprimer</button>
            </div>
          ))}
      </div>
    </div>
  );
}
