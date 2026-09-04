"use client";

// Couche d'accès aux données Supabase — un hook + des fonctions de mutation
// par table. C'est ici (et seulement ici) que les noms de colonnes
// snake_case de Postgres sont convertis vers/depuis le camelCase utilisé
// dans toute l'UI (repris tel quel de borne-casa-di-nathano.jsx), pour que
// la logique métier et les composants restent un portage 1:1 de la source.

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { useRealtimeTable } from "./useRealtimeTable";
import { RESTAURANT_ID, useRestaurantFilter } from "./restaurant";
import { isTakeawayLike } from "./business";

// Filtre explicite (utilisé par l'espace Direction uniquement) si présent,
// sinon pas de filtre — la borne/équipe compte sur RLS pour ne voir que son
// propre restaurant, un manager doit préciser lequel il regarde.
function useRestaurantEq() {
  const filter = useRestaurantFilter();
  return filter ? { column: "restaurant_id", value: filter } : undefined;
}

// ---------------------------------------------------------------- orders --

function mapOrderRow(row) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    items: row.items || [],
    serviceType: row.service_type,
    name: row.name,
    tableIds: row.table_ids || [],
    tableLabel: row.table_label || null,
    note: row.note,
    slotAllocations: row.slot_allocations || [],
    slotForced: row.slot_forced,
    pizzaCount: row.pizza_count,
    total: Number(row.total),
    status: row.status,
    paid: row.paid,
    previousStatus: row.previous_status,
    previousPaid: row.previous_paid,
    stockDecrementedAt: row.stock_decremented_at ? new Date(row.stock_decremented_at).getTime() : null,
    aperoStatus: row.apero_status,
    scheduledFor: row.scheduled_for,
    scheduledTime: row.scheduled_time,
    prepServed: row.prep_served,
    isTest: row.is_test,
    takeawayNumber: row.takeaway_number,
    delivered: row.delivered,
    drinksServed: row.drinks_served,
    ovenDoneAt: row.oven_done_at ? new Date(row.oven_done_at).getTime() : null,
    finitionDoneAt: row.finition_done_at ? new Date(row.finition_done_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
  };
}

const ORDER_FIELD_TO_COLUMN = {
  items: "items",
  serviceType: "service_type",
  name: "name",
  tableIds: "table_ids",
  tableLabel: "table_label",
  note: "note",
  slotAllocations: "slot_allocations",
  slotForced: "slot_forced",
  pizzaCount: "pizza_count",
  total: "total",
  status: "status",
  paid: "paid",
  previousStatus: "previous_status",
  previousPaid: "previous_paid",
  stockDecrementedAt: "stock_decremented_at",
  aperoStatus: "apero_status",
  scheduledFor: "scheduled_for",
  scheduledTime: "scheduled_time",
  prepServed: "prep_served",
  isTest: "is_test",
  ovenDoneAt: "oven_done_at",
  finitionDoneAt: "finition_done_at",
  delivered: "delivered",
  drinksServed: "drinks_served",
  takeawayNumber: "takeaway_number",
};

export function useOrders() {
  const { rows, loading, reload } = useRealtimeTable({
    table: "orders",
    mapRow: mapOrderRow,
    orderColumn: "created_at",
    orderAscending: true,
    eq: useRestaurantEq(),
  });
  return { orders: rows, loading, reload };
}

export async function insertOrder(order) {
  let takeawayNumber = null;
  if (isTakeawayLike(order.serviceType)) {
    const { data, error: rpcError } = await supabase.rpc("next_takeaway_number");
    if (rpcError) throw rpcError;
    takeawayNumber = data;
  }
  const { error } = await supabase.from("orders").insert({
    restaurant_id: RESTAURANT_ID,
    items: order.items,
    service_type: order.serviceType,
    name: order.name,
    table_ids: order.tableIds || [],
    table_label: order.tableLabel || null,
    note: order.note || null,
    slot_allocations: order.slotAllocations || [],
    slot_forced: order.slotForced ?? false,
    pizza_count: order.pizzaCount,
    total: order.total,
    status: order.status || "attente",
    paid: order.paid ?? false,
    apero_status: order.aperoStatus ?? null,
    scheduled_for: order.scheduledFor ?? null,
    scheduled_time: order.scheduledTime ?? null,
    is_test: order.isTest ?? false,
    takeaway_number: takeawayNumber,
  });
  if (error) throw error;
  return takeawayNumber;
}

// Commande en ligne (click & collect) : passe par la Route Handler /api/commande
// au lieu d'insérer directement, pour capturer l'IP côté serveur et créer
// atomiquement la commande + sa ligne d'engagement (order_commitments). On
// transmet le jeton de session Supabase pour que la RLS s'applique côté serveur
// comme si l'insert venait du client. Renvoie le numéro à emporter, ou lève —
// le wrapper submitWithRetry côté TakeawayOrder rejoue jusqu'à 3 fois.
export async function submitTakeawayOrderWithCommitment({ order, commitment }) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Session Supabase absente");

  const res = await fetch("/api/commande", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      items: order.items,
      serviceType: order.serviceType,
      name: order.name,
      slotAllocations: order.slotAllocations || [],
      pizzaCount: order.pizzaCount,
      total: order.total,
      phone: commitment.phone,
      commitmentAccepted: commitment.accepted,
      cgvSnapshot: commitment.cgvSnapshot,
      cgvVersion: commitment.cgvVersion,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Échec de la commande (${res.status})`);
  return json.takeawayNumber ?? null;
}

// Utilisé quand une commande bascule vers "à emporter" après coup (édition
// d'une commande déjà passée en "sur place") — même compteur atomique que
// insertOrder, pour ne jamais distribuer deux fois le même numéro.
export async function assignTakeawayNumber() {
  const { data, error } = await supabase.rpc("next_takeaway_number");
  if (error) throw error;
  return data;
}

export async function deleteAllTestOrders() {
  const { error } = await supabase.from("orders").delete().eq("is_test", true);
  if (error) throw error;
}

export async function updateOrder(id, patch) {
  const row = {};
  for (const [key, value] of Object.entries(patch)) {
    row[ORDER_FIELD_TO_COLUMN[key] || key] = value;
  }
  const { error } = await supabase.from("orders").update(row).eq("id", id);
  if (error) throw error;
}

// Ajoute des articles à une commande sur place déjà ouverte, via la fonction
// Postgres sat_append_items (un seul UPDATE atomique — pas de course si la
// serveuse et un client /sat valident au même instant). `newItems` : uniquement
// les lignes ajoutées, déjà au format items[] (avec leur éventuel `source`).
// `reopenKitchen` (booléen calculé par l'appelant via kitchenPendingQty) :
// rouvre le circuit four/finition si la commande l'avait déjà dépassé.
export async function appendItemsToOrder(orderId, { newItems, addedTotal, addedPizzaCount, reopenKitchen, extraTableIds }) {
  const { error } = await supabase.rpc("sat_append_items", {
    p_order_id: orderId,
    p_items: newItems,
    p_added_total: addedTotal ?? 0,
    p_added_pizza_count: addedPizzaCount ?? 0,
    p_reopen_kitchen: !!reopenKitchen,
    p_extra_table_ids: extraTableIds || [],
  });
  if (error) throw error;
}

// À utiliser partout où un bouton fait passer une commande à "servie" (elle
// disparaît alors de tous les écrans équipe) — mémorise le statut/paiement
// juste avant, pour permettre un `restoreOrder` en cas de mauvais bouton.
// `extraPatch` porte les autres champs propres à ce bouton précis (ex.
// `{ paid: true }` pour "Payée et servie").
export async function markOrderServed(order, extraPatch = {}) {
  await updateOrder(order.id, { ...extraPatch, status: "servie", previousStatus: order.status, previousPaid: order.paid });
  // Ne bloque jamais le passage à "servie" (l'action demandée par le clic) :
  // la décrémentation de stock est secondaire, elle se rattrape plus tard si
  // elle échoue (voir decrementStockForOrder, jamais réessayée automatiquement).
  decrementStockForOrder(order).catch((err) => console.error("decrementStockForOrder a échoué", err));
}

// Remet une commande "servie" par erreur exactement où elle en était — seuls
// status/paid sont restaurés car aucun autre champ (items[].served,
// ovenDoneAt, finitionDoneAt, delivered, aperoStatus) n'est jamais modifié
// par le passage à "servie" qu'on annule ici. Efface ensuite l'instantané
// pour ne pas permettre de restaurer deux fois.
export async function restoreOrder(order) {
  await updateOrder(order.id, { status: order.previousStatus, paid: order.previousPaid, previousStatus: null, previousPaid: null });
}

export async function deleteOrders(ids) {
  if (!ids.length) return;
  const { error } = await supabase.from("orders").delete().in("id", ids);
  if (error) throw error;
}

// ----------------------------------------------------------------- slots --

function mapSlotRow(row) {
  return { id: row.id, label: row.label, capacity: row.capacity };
}

export function useSlots() {
  const { rows, loading, reload } = useRealtimeTable({ table: "slots", mapRow: mapSlotRow, eq: useRestaurantEq() });
  return { slots: rows, loading, reload };
}

export async function insertSlot({ label, capacity }) {
  const { error } = await supabase.from("slots").upsert({ restaurant_id: RESTAURANT_ID, label, capacity }, { onConflict: "restaurant_id,label" });
  if (error) throw error;
}

export async function updateSlotCapacity(id, capacity) {
  const { error } = await supabase.from("slots").update({ capacity }).eq("id", id);
  if (error) throw error;
}

export async function deleteSlot(id) {
  const { error } = await supabase.from("slots").delete().eq("id", id);
  if (error) throw error;
}

export async function clearAllSlots() {
  const { error } = await supabase.from("slots").delete().neq("label", "__never__");
  if (error) throw error;
}

// Génération en masse (service midi/soir) : crée les créneaux manquants,
// met à jour la capacité de ceux qui existent déjà pour le même horaire.
export async function bulkUpsertSlots(list) {
  if (!list.length) return;
  const { error } = await supabase
    .from("slots")
    .upsert(
      list.map(({ label, capacity }) => ({ restaurant_id: RESTAURANT_ID, label, capacity })),
      { onConflict: "restaurant_id,label" }
    );
  if (error) throw error;
}

// -------------------------------------------------------------- ruptures --

export function useRuptures() {
  const { rows, loading, reload } = useRealtimeTable({ table: "ruptures", mapRow: (r) => r.item_id, eq: useRestaurantEq() });
  return { ruptures: rows, loading, reload };
}

export async function addRupture(itemId) {
  const { error } = await supabase.from("ruptures").upsert({ restaurant_id: RESTAURANT_ID, item_id: itemId });
  if (error) throw error;
}

export async function removeRupture(itemId) {
  const { error } = await supabase.from("ruptures").delete().eq("item_id", itemId);
  if (error) throw error;
}

// ---------------------------------------------------------------- tables --
// Registre des tables physiques du restaurant (Logistique → Tables). Alimente
// le sélecteur de la prise de commande serveuse et le lien client /sat?table=N.

// `number` = code stable encodé dans le QR (/sat?table=N), figé à la création.
// `label` = nom affiché partout, librement renommable par l'équipe.
function mapTableRow(row) {
  return {
    id: row.id,
    number: row.number,
    label: row.label || null,
    active: row.active,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export function useTables() {
  const { rows, loading, reload } = useRealtimeTable({ table: "tables", mapRow: mapTableRow, eq: useRestaurantEq() });
  return { tables: rows, loading, reload };
}

// À la création, le nom saisi sert à la fois de code QR (`number`) et de nom
// affiché initial (`label`) — le nom reste ensuite modifiable sans toucher au QR.
export async function addTable(name) {
  const v = String(name).trim();
  const { error } = await supabase.from("tables").insert({ restaurant_id: RESTAURANT_ID, number: v, label: v });
  if (error) throw error;
}

export async function setTableLabel(id, label) {
  const { error } = await supabase.from("tables").update({ label: String(label).trim() || null }).eq("id", id);
  if (error) throw error;
}

export async function setTableActive(id, active) {
  const { error } = await supabase.from("tables").update({ active }).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------- dessert_stock --

export function useDessertStock() {
  const { rows, loading, reload } = useRealtimeTable({ table: "dessert_stock", mapRow: (r) => r, eq: useRestaurantEq() });
  const dessertStock = Object.fromEntries(rows.map((r) => [r.key, r.qty]));
  return { dessertStock, loading, reload };
}

export async function setDessertStockQty(key, qty) {
  const { error } = await supabase.from("dessert_stock").upsert({ restaurant_id: RESTAURANT_ID, key, qty }, { onConflict: "restaurant_id,key" });
  if (error) throw error;
}

// ------------------------------------------------------------- menu_items --
// Le menu complet (produits d'origine + produits ajoutés) — tout est
// éditable depuis Logistique → Menu, plus de distinction "de base"/"ajouté".

function mapMenuItemRow(row) {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    cat: row.cat,
    ingredients: row.ingredients || undefined,
    photoUrl: row.photo_url || null,
    dineInOnly: row.dine_in_only || false,
    featured: row.featured || false,
  };
}

export function useMenu() {
  const { rows, loading, reload } = useRealtimeTable({
    table: "menu_items",
    mapRow: mapMenuItemRow,
    orderColumn: "name",
  });
  return { menuItems: rows, loading, reload };
}

export async function insertMenuItem({ id, name, price, cat, ingredients, photoUrl, dineInOnly, featured }) {
  const { error } = await supabase.from("menu_items").insert({
    id,
    name,
    price,
    cat,
    ingredients: ingredients ?? null,
    photo_url: photoUrl ?? null,
    dine_in_only: dineInOnly ?? false,
    featured: featured ?? false,
  });
  if (error) throw error;
}

export async function updateMenuItem(id, { name, price, cat, ingredients, photoUrl, dineInOnly, featured }) {
  const row = {};
  if (name !== undefined) row.name = name;
  if (price !== undefined) row.price = price;
  if (cat !== undefined) row.cat = cat;
  if (ingredients !== undefined) row.ingredients = ingredients;
  if (photoUrl !== undefined) row.photo_url = photoUrl;
  if (dineInOnly !== undefined) row.dine_in_only = dineInOnly;
  if (featured !== undefined) row.featured = featured;
  const { error } = await supabase.from("menu_items").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteMenuItem(id) {
  const { error } = await supabase.from("menu_items").delete().eq("id", id);
  if (error) throw error;
}

// Upload d'une photo produit vers le bucket public "menu-photos", renvoie son URL publique.
export async function uploadMenuPhoto(file) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("menu-photos").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("menu-photos").getPublicUrl(path);
  return data.publicUrl;
}

// -------------------------------------------------------------- table_plan --

const EMPTY_PLAN = {
  defaultLayout: { interieur: [], exterieur: [], mangedebout: [] },
  currentLayout: { interieur: [], exterieur: [], mangedebout: [] },
};

function mapTablePlanRow(row) {
  return { defaultLayout: row.default_layout, currentLayout: row.current_layout };
}

export function useTablePlan() {
  const { rows, loading, reload } = useRealtimeTable({ table: "table_plan", mapRow: mapTablePlanRow, eq: useRestaurantEq() });
  return { tablePlan: rows[0] || EMPTY_PLAN, loading, reload };
}

export async function saveTablePlan(plan) {
  const { error } = await supabase
    .from("table_plan")
    .update({ default_layout: plan.defaultLayout, current_layout: plan.currentLayout })
    .eq("restaurant_id", RESTAURANT_ID);
  if (error) throw error;
}

// ------------------------------------------------------------- team_config --

export function useTeamPin() {
  const { rows, loading, reload } = useRealtimeTable({ table: "team_config", mapRow: (r) => r.pin, eq: useRestaurantEq() });
  return { pin: rows[0] || "0505", loading, reload };
}

export async function setTeamPin(pin) {
  const { error } = await supabase.from("team_config").update({ pin }).eq("restaurant_id", RESTAURANT_ID);
  if (error) throw error;
}

const EMPTY_SERVICE_TYPE_SETTINGS = { dineInEnabled: true, takeawayEnabled: true, dineInCountsTowardSlots: true };

export function useServiceTypeSettings() {
  const { rows, loading, reload } = useRealtimeTable({
    table: "team_config",
    mapRow: (r) => ({
      dineInEnabled: r.service_dine_in_enabled,
      takeawayEnabled: r.service_takeaway_enabled,
      dineInCountsTowardSlots: r.dine_in_counts_toward_slots,
    }),
    eq: useRestaurantEq(),
  });
  return { serviceTypeSettings: rows[0] || EMPTY_SERVICE_TYPE_SETTINGS, loading, reload };
}

export async function setServiceTypeEnabled(key, enabled) {
  const COLUMN_BY_KEY = { dineIn: "service_dine_in_enabled", takeaway: "service_takeaway_enabled" };
  const column = COLUMN_BY_KEY[key];
  if (!column) throw new Error(`Type de service inconnu: ${key}`);
  const { error } = await supabase.from("team_config").update({ [column]: enabled }).eq("restaurant_id", RESTAURANT_ID);
  if (error) throw error;
}

// Le pâton est toujours décompté pour une commande "sur place" (voir
// remainingPizzaStock) — ce réglage ne concerne que le décompte des créneaux
// four, que le pizzaiolo peut activer/désactiver selon comment il veut piloter
// sa cadence de four (voir SlotsAdmin).
export async function setDineInCountsTowardSlots(enabled) {
  const { error } = await supabase.from("team_config").update({ dine_in_counts_toward_slots: enabled }).eq("restaurant_id", RESTAURANT_ID);
  if (error) throw error;
}

export function useTakeawayLinkStatus() {
  const { rows, loading, reload } = useRealtimeTable({
    table: "team_config",
    mapRow: (r) => r.takeaway_link_suspended || false,
    eq: useRestaurantEq(),
  });
  return { suspended: rows[0] || false, loading, reload };
}

export async function setTakeawayLinkSuspended(suspended) {
  const { error } = await supabase.from("team_config").update({ takeaway_link_suspended: suspended }).eq("restaurant_id", RESTAURANT_ID);
  if (error) throw error;
}

const EMPTY_SLOT_DEFAULTS = { midiCapacity: 6, soirCapacity: 6 };

export function useSlotDefaults() {
  const { rows, loading, reload } = useRealtimeTable({
    table: "team_config",
    mapRow: (r) => ({ midiCapacity: r.midi_capacity, soirCapacity: r.soir_capacity }),
    eq: useRestaurantEq(),
  });
  return { slotDefaults: rows[0] || EMPTY_SLOT_DEFAULTS, loading, reload };
}

export async function setSlotDefaults({ midiCapacity, soirCapacity }) {
  const row = {};
  if (midiCapacity !== undefined) row.midi_capacity = midiCapacity;
  if (soirCapacity !== undefined) row.soir_capacity = soirCapacity;
  const { error } = await supabase.from("team_config").update(row).eq("restaurant_id", RESTAURANT_ID);
  if (error) throw error;
}

// ------------------------------------------------------------- pizza_stock --

const EMPTY_PIZZA_STOCK = { total: 0, safetyMargin: 0 };

function mapPizzaStockRow(row) {
  return { total: row.total, safetyMargin: row.safety_margin };
}

export function usePizzaStock() {
  const { rows, loading, reload } = useRealtimeTable({ table: "pizza_stock", mapRow: mapPizzaStockRow, eq: useRestaurantEq() });
  return { pizzaStock: rows[0] || EMPTY_PIZZA_STOCK, loading, reload };
}

export async function setPizzaStock({ total, safetyMargin }) {
  const { error } = await supabase.from("pizza_stock").update({ total, safety_margin: safetyMargin }).eq("restaurant_id", RESTAURANT_ID);
  if (error) throw error;
}

// -------------------------------------------------------------- test_mode --

export function useTestMode() {
  const { rows, loading, reload } = useRealtimeTable({ table: "test_mode", mapRow: (r) => r.enabled, eq: useRestaurantEq() });
  return { testMode: { enabled: rows[0] || false }, loading, reload };
}

export async function setTestModeEnabled(enabled) {
  const { error } = await supabase.from("test_mode").update({ enabled }).eq("restaurant_id", RESTAURANT_ID);
  if (error) throw error;
}

// ------------------------------------------------------------ ingredients --
// Catalogue partagé (comme menu_items), édition réservée aux managers côté RLS.

function mapIngredientRow(row) {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    costPerUnit: Number(row.cost_per_unit),
    purchaseQty: row.purchase_qty !== null ? Number(row.purchase_qty) : null,
    purchaseUnit: row.purchase_unit,
    purchasePrice: row.purchase_price !== null ? Number(row.purchase_price) : null,
    supplierId: row.supplier_id,
  };
}

export function useIngredients() {
  const { rows, loading, reload } = useRealtimeTable({ table: "ingredients", mapRow: mapIngredientRow, orderColumn: "name" });
  return { ingredients: rows, loading, reload };
}

export async function insertIngredient({ name, unit, costPerUnit, purchaseQty, purchaseUnit, purchasePrice, supplierId }) {
  const { error } = await supabase.from("ingredients").insert({
    name,
    unit,
    cost_per_unit: costPerUnit,
    purchase_qty: purchaseQty ?? null,
    purchase_unit: purchaseUnit ?? null,
    purchase_price: purchasePrice ?? null,
    supplier_id: supplierId ?? null,
  });
  if (error) throw error;
}

export async function updateIngredient(id, { name, unit, costPerUnit, purchaseQty, purchaseUnit, purchasePrice, supplierId }) {
  const row = {};
  if (name !== undefined) row.name = name;
  if (unit !== undefined) row.unit = unit;
  if (costPerUnit !== undefined) row.cost_per_unit = costPerUnit;
  if (purchaseQty !== undefined) row.purchase_qty = purchaseQty;
  if (purchaseUnit !== undefined) row.purchase_unit = purchaseUnit;
  if (purchasePrice !== undefined) row.purchase_price = purchasePrice;
  if (supplierId !== undefined) row.supplier_id = supplierId;
  const { error } = await supabase.from("ingredients").update(row).eq("id", id);
  if (error) throw error;
}

// -------------------------------------------------------------- suppliers --

function mapSupplierRow(row) {
  return { id: row.id, name: row.name };
}

export function useSuppliers() {
  const { rows, loading, reload } = useRealtimeTable({ table: "suppliers", mapRow: mapSupplierRow, orderColumn: "name" });
  return { suppliers: rows, loading, reload };
}

export async function insertSupplier(name) {
  const { error } = await supabase.from("suppliers").insert({ name });
  if (error) throw error;
}

export async function updateSupplier(id, name) {
  const { error } = await supabase.from("suppliers").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteSupplier(id) {
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw error;
}

export async function setIngredientSupplier(ingredientId, supplierId) {
  const { error } = await supabase.from("ingredients").update({ supplier_id: supplierId }).eq("id", ingredientId);
  if (error) throw error;
}

export async function deleteIngredient(id) {
  const { error } = await supabase.from("ingredients").delete().eq("id", id);
  if (error) throw error;
}

// -------------------------------------------------------- pizza_ingredients --
// Recette : quantité d'un ingrédient pour une pizza donnée (menu_items.id).

function mapPizzaIngredientRow(row) {
  return { id: row.id, menuItemId: row.menu_item_id, ingredientId: row.ingredient_id, quantity: Number(row.quantity) };
}

export function usePizzaIngredients() {
  const { rows, loading, reload } = useRealtimeTable({ table: "pizza_ingredients", mapRow: mapPizzaIngredientRow });
  return { pizzaIngredients: rows, loading, reload };
}

export async function setPizzaIngredient(menuItemId, ingredientId, quantity) {
  const { error } = await supabase
    .from("pizza_ingredients")
    .upsert({ menu_item_id: menuItemId, ingredient_id: ingredientId, quantity }, { onConflict: "menu_item_id,ingredient_id" });
  if (error) throw error;
}

export async function removePizzaIngredient(menuItemId, ingredientId) {
  const { error } = await supabase.from("pizza_ingredients").delete().eq("menu_item_id", menuItemId).eq("ingredient_id", ingredientId);
  if (error) throw error;
}

// -------------------------------------------------------------- daily_sales --
// Archive historique (alimentée chaque nuit, voir schema.sql) — pas de temps
// réel ici, interrogée ponctuellement pour une période choisie.

// Archive nocturne de la répartition des sources (reporting SAT §7). Pas de
// filtre restaurant : la RLS renvoie son propre restaurant, ou les deux pour un
// manager (Espace Direction). Trié par date croissante.
export async function fetchSourceStats(startDate, endDate) {
  const { data, error } = await supabase
    .from("source_stats_daily")
    .select("restaurant_id, date, lines_total, lines_serveuse, lines_sat, lines_click_and_collect, orders_total, orders_with_autonomy")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchDailySales(restaurantId, startDate, endDate) {
  const { data, error } = await supabase
    .from("daily_sales")
    .select("date, menu_item_id, qty")
    .eq("restaurant_id", restaurantId)
    .gte("date", startDate)
    .lte("date", endDate);
  if (error) throw error;
  return data || [];
}

// -------------------------------------------------------- consumption_actuals --

export async function fetchConsumptionActuals(restaurantId, startDate, endDate) {
  const { data, error } = await supabase
    .from("consumption_actuals")
    .select("id, ingredient_id, qty_actual")
    .eq("restaurant_id", restaurantId)
    .eq("period_start", startDate)
    .eq("period_end", endDate);
  if (error) throw error;
  return data || [];
}

export async function setConsumptionActual(restaurantId, ingredientId, startDate, endDate, qtyActual) {
  const { error } = await supabase
    .from("consumption_actuals")
    .upsert(
      { restaurant_id: restaurantId, ingredient_id: ingredientId, period_start: startDate, period_end: endDate, qty_actual: qtyActual },
      { onConflict: "restaurant_id,ingredient_id,period_start,period_end" }
    );
  if (error) throw error;
}

// ------------------------------------------------------------------- appro --
// Module approvisionnement (fournisseurs/produits/stock), distinct du module
// cout de revient ci-dessus (suppliers/ingredients). Stock PARTAGE entre les
// deux restaurants (voir schema.sql) : pas de filtre restaurant_id ici.

function mapApproSupplierRow(row) {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    deliveryDay: row.delivery_day,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export function useApproSuppliers() {
  const { rows, loading, reload } = useRealtimeTable({ table: "appro_suppliers", mapRow: mapApproSupplierRow, orderColumn: "name" });
  return { approSuppliers: rows, loading, reload };
}

export async function insertApproSupplier({ name, contactName, phone, email, deliveryDay, notes }) {
  const { error } = await supabase.from("appro_suppliers").insert({
    name,
    contact_name: contactName || null,
    phone: phone || null,
    email: email || null,
    delivery_day: deliveryDay || null,
    notes: notes || null,
  });
  if (error) throw error;
}

export async function updateApproSupplier(id, { name, contactName, phone, email, deliveryDay, notes, isActive }) {
  const row = {};
  if (name !== undefined) row.name = name;
  if (contactName !== undefined) row.contact_name = contactName || null;
  if (phone !== undefined) row.phone = phone || null;
  if (email !== undefined) row.email = email || null;
  if (deliveryDay !== undefined) row.delivery_day = deliveryDay || null;
  if (notes !== undefined) row.notes = notes || null;
  if (isActive !== undefined) row.is_active = isActive;
  const { error } = await supabase.from("appro_suppliers").update(row).eq("id", id);
  if (error) throw error;
}

function mapApproProductRow(row) {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    primarySupplierId: row.primary_supplier_id,
    currentStock: Number(row.current_stock),
    alertThreshold: row.alert_threshold === null ? null : Number(row.alert_threshold),
    isActive: row.is_active,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export function useApproProducts() {
  const { rows, loading, reload } = useRealtimeTable({ table: "appro_products", mapRow: mapApproProductRow, orderColumn: "name" });
  return { approProducts: rows, loading, reload };
}

export async function insertApproProduct({ name, unit, primarySupplierId, alertThreshold }) {
  const { error } = await supabase.from("appro_products").insert({
    name,
    unit,
    primary_supplier_id: primarySupplierId || null,
    alert_threshold: alertThreshold === "" || alertThreshold == null ? null : alertThreshold,
  });
  if (error) throw error;
}

export async function updateApproProduct(id, { name, unit, primarySupplierId, alertThreshold, isActive }) {
  const row = {};
  if (name !== undefined) row.name = name;
  if (unit !== undefined) row.unit = unit;
  if (primarySupplierId !== undefined) row.primary_supplier_id = primarySupplierId || null;
  if (alertThreshold !== undefined) row.alert_threshold = alertThreshold === "" || alertThreshold == null ? null : alertThreshold;
  if (isActive !== undefined) row.is_active = isActive;
  const { error } = await supabase.from("appro_products").update(row).eq("id", id);
  if (error) throw error;
}

// Jamais de mise a jour directe de current_stock -- uniquement via une ligne
// ici (voir trigger appro_recalc_stock, schema.sql). movementType parmi
// achat/vente/perte/correction/retour ; quantity positif = entree, negatif =
// sortie (a l'appelant de poser le bon signe selon le type).
export async function insertApproStockMovement({ productId, movementType, quantity, reason, createdBy }) {
  const { error } = await supabase.from("appro_stock_movements").insert({
    product_id: productId,
    movement_type: movementType,
    quantity,
    reason: reason || null,
    created_by: createdBy || null,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------- recettes --
// Une recette par article vendable (menu_items.id), utilisée pour
// décrémenter automatiquement le stock à la vente (voir
// decrementStockForOrder ci-dessous).

function mapApproRecipeRow(row) {
  return { id: row.id, menuItemId: row.menu_item_id, notes: row.notes, createdAt: new Date(row.created_at).getTime() };
}

export function useApproRecipes() {
  const { rows, loading, reload } = useRealtimeTable({ table: "appro_recipes", mapRow: mapApproRecipeRow });
  return { approRecipes: rows, loading, reload };
}

export async function insertApproRecipe({ menuItemId, notes }) {
  const { data, error } = await supabase.from("appro_recipes").insert({ menu_item_id: menuItemId, notes: notes || null }).select().single();
  if (error) throw error;
  return mapApproRecipeRow(data);
}

export async function updateApproRecipe(id, { notes }) {
  const { error } = await supabase.from("appro_recipes").update({ notes: notes || null }).eq("id", id);
  if (error) throw error;
}

export async function deleteApproRecipe(id) {
  const { error } = await supabase.from("appro_recipes").delete().eq("id", id);
  if (error) throw error;
}

function mapApproRecipeIngredientRow(row) {
  return { id: row.id, recipeId: row.recipe_id, productId: row.product_id, quantityPerUnit: Number(row.quantity_per_unit), unit: row.unit };
}

export function useApproRecipeIngredients() {
  const { rows, loading, reload } = useRealtimeTable({ table: "appro_recipe_ingredients", mapRow: mapApproRecipeIngredientRow });
  return { approRecipeIngredients: rows, loading, reload };
}

export async function insertApproRecipeIngredient({ recipeId, productId, quantityPerUnit, unit }) {
  const { error } = await supabase
    .from("appro_recipe_ingredients")
    .insert({ recipe_id: recipeId, product_id: productId, quantity_per_unit: quantityPerUnit, unit });
  if (error) throw error;
}

export async function updateApproRecipeIngredient(id, { quantityPerUnit, unit }) {
  const row = {};
  if (quantityPerUnit !== undefined) row.quantity_per_unit = quantityPerUnit;
  if (unit !== undefined) row.unit = unit;
  const { error } = await supabase.from("appro_recipe_ingredients").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteApproRecipeIngredient(id) {
  const { error } = await supabase.from("appro_recipe_ingredients").delete().eq("id", id);
  if (error) throw error;
}

// Décrémente le stock des ingrédients de chaque article vendu ayant une
// recette définie — appelée automatiquement par markOrderServed, jamais
// directement. Idempotente (stockDecrementedAt) : une commande ne décrémente
// jamais deux fois, y compris après un passage par "Restaurer" (voir
// schema.sql, colonne orders.stock_decremented_at).
export async function decrementStockForOrder(order) {
  if (order.stockDecrementedAt) return;

  const menuItemIds = [...new Set((order.items || []).map((it) => it.id).filter(Boolean))];
  if (menuItemIds.length === 0) {
    await updateOrder(order.id, { stockDecrementedAt: new Date().toISOString() });
    return;
  }

  const { data: recipes, error: recipesErr } = await supabase.from("appro_recipes").select("id, menu_item_id").in("menu_item_id", menuItemIds);
  if (recipesErr) {
    console.error("decrementStockForOrder : lecture des recettes échouée", recipesErr);
    return;
  }
  const recipeIdByMenuItem = new Map(recipes.map((r) => [r.menu_item_id, r.id]));
  const recipeIds = recipes.map((r) => r.id);

  const ingredientsByRecipe = new Map();
  if (recipeIds.length > 0) {
    const { data: ingredients, error: ingErr } = await supabase
      .from("appro_recipe_ingredients")
      .select("recipe_id, product_id, quantity_per_unit")
      .in("recipe_id", recipeIds);
    if (ingErr) {
      console.error("decrementStockForOrder : lecture des ingrédients échouée", ingErr);
      return;
    }
    for (const ing of ingredients) {
      if (!ingredientsByRecipe.has(ing.recipe_id)) ingredientsByRecipe.set(ing.recipe_id, []);
      ingredientsByRecipe.get(ing.recipe_id).push(ing);
    }
  }

  const movements = [];
  for (const item of order.items || []) {
    if (!item.id) continue;
    const recipeId = recipeIdByMenuItem.get(item.id);
    if (!recipeId) {
      // Article vendu sans recette définie -- volontairement silencieux côté
      // UI (voir cahier des charges), juste loggué pour repérage.
      console.error(`decrementStockForOrder : aucune recette pour "${item.name}" (${item.id}), commande ${order.id}`);
      continue;
    }
    for (const ing of ingredientsByRecipe.get(recipeId) || []) {
      movements.push({
        product_id: ing.product_id,
        movement_type: "vente",
        quantity: -(ing.quantity_per_unit * item.qty),
        reason: `Vente : ${item.name} x${item.qty}`,
        order_id: order.id,
      });
    }
  }

  if (movements.length > 0) {
    const { error: insertErr } = await supabase.from("appro_stock_movements").insert(movements);
    if (insertErr) {
      console.error("decrementStockForOrder : insertion des mouvements échouée", insertErr);
      return; // pas de stockDecrementedAt si l'insertion a vraiment échoué -- à corriger manuellement si ça arrive
    }
  }
  await updateOrder(order.id, { stockDecrementedAt: new Date().toISOString() });
}

// ---------------------------------------------------------------- fidélité --
// Base clients fidélité PARTAGÉE entre les deux restaurants (pas de
// restaurant_id) — cf. supabase/schema.sql. Toute la logique sensible
// (attribution de points, paliers 150) vit dans des fonctions Postgres ;
// côté app on ne fait que de la consultation + la réactivation manuelle
// d'un bon expiré.

function mapLoyaltyCustomerRow(row) {
  return {
    id: row.id,
    phone: row.phone,
    nom: row.nom,
    dateAnniversaire: row.date_anniversaire, // 'YYYY-MM-DD' ou null
    soldePoints: row.solde_points,
    walletAddedAt: row.wallet_added_at ? new Date(row.wallet_added_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function mapLoyaltyMovementRow(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    type: row.type, // gain | depense | ajustement
    points: row.points,
    orderId: row.order_id,
    source: row.source, // click_and_collect | caisse | null
    note: row.note || null, // motif libre (ajout de points manuel uniquement)
    createdAt: new Date(row.created_at).getTime(),
  };
}

function mapPromoCodeRow(row) {
  return {
    id: row.id,
    code: row.code,
    customerId: row.customer_id,
    reduction: Number(row.reduction),
    reason: row.reason, // palier_150 | anniversaire
    status: row.status, // actif | expire | utilise
    createdAt: new Date(row.created_at).getTime(),
    expiresAt: new Date(row.expires_at).getTime(),
  };
}

// Recherche ponctuelle par téléphone — l'appelant doit déjà avoir normalisé
// via canonicalLoyaltyPhone. Renvoie le client ou null.
export async function fetchLoyaltyCustomerByPhone(phone) {
  const { data, error } = await supabase.from("loyalty_customers").select("*").eq("phone", phone).maybeSingle();
  if (error) throw error;
  return data ? mapLoyaltyCustomerRow(data) : null;
}

// Recherche souple pour l'écran Fidélité : par nom/prénom (insensible à la
// casse ET aux accents) ou par fragment de numéro si le terme est surtout
// numérique. La logique vit dans la fonction Postgres search_loyalty_customers
// (unaccent inaccessible depuis .ilike()). Liste triée par nom, max 50.
export async function searchLoyaltyCustomers(term) {
  const cleaned = String(term || "").trim();
  if (cleaned.length < 2) return [];
  const { data, error } = await supabase.rpc("search_loyalty_customers", { p_term: cleaned });
  if (error) throw error;
  return (data || []).map(mapLoyaltyCustomerRow);
}

export async function createLoyaltyCustomer({ phone, nom, dateAnniversaire }) {
  const { data, error } = await supabase
    .from("loyalty_customers")
    .insert({ phone, nom: nom || null, date_anniversaire: dateAnniversaire || null })
    .select()
    .single();
  if (error) throw error;
  return mapLoyaltyCustomerRow(data);
}

export async function updateLoyaltyCustomer(id, { nom, dateAnniversaire }) {
  const row = {};
  if (nom !== undefined) row.nom = nom || null;
  if (dateAnniversaire !== undefined) row.date_anniversaire = dateAnniversaire || null;
  const { error } = await supabase.from("loyalty_customers").update(row).eq("id", id);
  if (error) throw error;
}

// Fiche client en direct (le solde bouge dès qu'un gain est attribué). À ne
// monter qu'avec un customerId réel (le composant parent ne rend la fiche
// qu'une fois un client sélectionné).
export function useLoyaltyCustomer(customerId) {
  const { rows, loading, reload } = useRealtimeTable({
    table: "loyalty_customers",
    mapRow: mapLoyaltyCustomerRow,
    eq: { column: "id", value: customerId },
  });
  return { customer: rows[0] || null, loading, reload };
}

export function useLoyaltyMovements(customerId) {
  const { rows, loading, reload } = useRealtimeTable({
    table: "loyalty_movements",
    mapRow: mapLoyaltyMovementRow,
    orderColumn: "created_at",
    orderAscending: false,
    eq: { column: "customer_id", value: customerId },
  });
  return { movements: rows, loading, reload };
}

export function useLoyaltyPromoCodes(customerId) {
  const { rows, loading, reload } = useRealtimeTable({
    table: "promo_codes",
    mapRow: mapPromoCodeRow,
    orderColumn: "created_at",
    orderAscending: false,
    eq: { column: "customer_id", value: customerId },
  });
  return { promoCodes: rows, loading, reload };
}

// Bon ajouté à la main depuis la fiche client (geste commercial) : 5 € par
// défaut, validité 21 j comme les bons automatiques. reason = 'manuel'.
// Le code est généré côté client ; en cas de collision (contrainte unique),
// on retente avec un nouveau code.
export async function addManualPromoCode(customerId, reduction = 5) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans I/O/0/1 ambigus
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = "CASA-" + Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    const { error } = await supabase.from("promo_codes").insert({
      code,
      customer_id: customerId,
      reduction,
      reason: "manuel",
      status: "actif",
      expires_at: new Date(Date.now() + 21 * 864e5).toISOString(),
    });
    if (!error) return;
    if (error.code !== "23505") throw error; // 23505 = violation d'unicité sur `code`
  }
  throw new Error("Impossible de générer un code unique (collisions répétées)");
}

// Réactive un bon expiré OU prolonge un bon actif (fiche client) : repasse
// 'actif' avec l'échéance choisie par l'équipe (ISO, fin de journée du jour
// retenu). Remplace l'ancien reactivatePromoCode à J+21 fixe.
export async function setPromoCodeExpiry(id, expiresAtIso) {
  const { error } = await supabase
    .from("promo_codes")
    .update({ status: "actif", expires_at: expiresAtIso })
    .eq("id", id);
  if (error) throw error;
}

// Suppression définitive d'un bon (erreur de saisie, geste commercial annulé…).
// Les points éventuellement consommés pour l'obtenir (palier 150) ne sont PAS
// re-crédités : à rajouter à la main depuis la fiche si besoin.
export async function deletePromoCode(id) {
  const { error } = await supabase.from("promo_codes").delete().eq("id", id);
  if (error) throw error;
}

// Attribution de points depuis la caisse manuelle (Phase E) — même fonction
// Postgres que le click & collect. Renvoie le nouveau solde, ou null si le
// numéro est invalide (rien n'est alors écrit).
export async function awardLoyaltyPointsFromCaisse(phone, amount, orderId) {
  const { data, error } = await supabase.rpc("award_loyalty_points", {
    p_phone: phone,
    p_amount: amount,
    p_order_id: orderId ?? null,
    p_source: "caisse",
  });
  if (error) throw error;
  return data;
}

// Ajout de points manuel depuis la fiche client équipe : cas où un client a
// oublié de donner son numéro à la commande et qu'on le crédite a posteriori,
// sans repasser par une fausse commande. Réutilise TELLE QUELLE la fonction
// Postgres award_loyalty_points (1 point crédité par unité passée en p_amount,
// mouvement 'gain', solde à jour avant l'insert, trigger palier 150). p_source
// = null : ni caisse ni click & collect. Le motif optionnel est ensuite posé
// sur le mouvement qu'on vient d'insérer (colonne loyalty_movements.note ;
// award_loyalty_points ne l'écrit pas). Renvoie le nouveau solde, ou null si
// le numéro du client est invalide (rien n'est alors écrit).
export async function awardLoyaltyPointsManual(customerId, phone, points, note) {
  const { data: newSolde, error } = await supabase.rpc("award_loyalty_points", {
    p_phone: phone,
    p_amount: points,
    p_order_id: null,
    p_source: null,
  });
  if (error) throw error;

  const trimmed = String(note || "").trim();
  if (newSolde != null && trimmed) {
    const { data: rows } = await supabase
      .from("loyalty_movements")
      .select("id")
      .eq("customer_id", customerId)
      .is("order_id", null)
      .is("source", null)
      .order("created_at", { ascending: false })
      .limit(1);
    const movementId = rows?.[0]?.id;
    if (movementId) {
      await supabase.from("loyalty_movements").update({ note: trimmed }).eq("id", movementId);
    }
  }
  return newSolde;
}

// Écran Caisse : pour la liste de commandes affichée, quelles sont celles déjà
// rattachées à un compte fidélité (= au moins un mouvement de points portant
// leur order_id), avec le nom/téléphone du client. Rechargé en direct dès que
// loyalty_movements change (association faite depuis une autre carte/écran).
export function useOrderLoyaltyLinks(orderIds) {
  const key = [...new Set(orderIds || [])].sort().join(",");
  const [links, setLinks] = useState({});

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) {
      setLinks({});
      return;
    }
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase
        .from("loyalty_movements")
        .select("order_id, customer_id, loyalty_customers(nom, phone)")
        .in("order_id", ids);
      if (cancelled || error) return;
      const map = {};
      for (const row of data || []) {
        if (!row.order_id) continue;
        map[row.order_id] = {
          customerId: row.customer_id,
          nom: row.loyalty_customers?.nom || null,
          phone: row.loyalty_customers?.phone || null,
        };
      }
      setLinks(map);
    }
    load();
    const channel = supabase
      .channel(`caisse_loyalty_links:${key}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "loyalty_movements" }, () => {
        if (!cancelled) load();
      })
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [key]);

  return links;
}

// ------------------------------------------ gabarits de messages fidélité --
// Textes des SMS fidélité, édités depuis l'espace Direction (managers via RLS).
// L'envoi effectif (OVH) sera branché en phase G.

function mapLoyaltyTemplateRow(row) {
  return {
    key: row.key,
    label: row.label,
    body: row.body,
    enabled: row.enabled,
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
  };
}

export function useLoyaltyMessageTemplates() {
  const { rows, loading, reload } = useRealtimeTable({
    table: "loyalty_message_templates",
    mapRow: mapLoyaltyTemplateRow,
    orderColumn: "key",
  });
  return { templates: rows, loading, reload };
}

// Upsert (et non update) pour rester fonctionnel même si une clé n'a pas été
// semée : le composant Direction connaît les libellés par défaut.
export async function upsertLoyaltyMessageTemplate({ key, label, body, enabled }) {
  const { error } = await supabase.from("loyalty_message_templates").upsert(
    { key, label, body, enabled, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
  if (error) throw error;
}

// Téléphone saisi par le client lors d'une commande en ligne (click & collect),
// stocké dans order_commitments. null si la commande n'en a pas (prise en salle
// ou à emporter par l'équipe).
export async function fetchOrderCommitmentPhone(orderId) {
  const { data, error } = await supabase
    .from("order_commitments")
    .select("customer_phone")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw error;
  return data?.customer_phone || null;
}
