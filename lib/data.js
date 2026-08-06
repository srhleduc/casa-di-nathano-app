"use client";

// Couche d'accès aux données Supabase — un hook + des fonctions de mutation
// par table. C'est ici (et seulement ici) que les noms de colonnes
// snake_case de Postgres sont convertis vers/depuis le camelCase utilisé
// dans toute l'UI (repris tel quel de borne-casa-di-nathano.jsx), pour que
// la logique métier et les composants restent un portage 1:1 de la source.

import { supabase } from "./supabaseClient";
import { useRealtimeTable } from "./useRealtimeTable";

// ---------------------------------------------------------------- orders --

function mapOrderRow(row) {
  return {
    id: row.id,
    items: row.items || [],
    serviceType: row.service_type,
    name: row.name,
    slotAllocations: row.slot_allocations || [],
    pizzaCount: row.pizza_count,
    total: Number(row.total),
    status: row.status,
    aperoStatus: row.apero_status,
    scheduledFor: row.scheduled_for,
    scheduledTime: row.scheduled_time,
    createdAt: new Date(row.created_at).getTime(),
  };
}

const ORDER_FIELD_TO_COLUMN = {
  items: "items",
  serviceType: "service_type",
  name: "name",
  slotAllocations: "slot_allocations",
  pizzaCount: "pizza_count",
  total: "total",
  status: "status",
  aperoStatus: "apero_status",
  scheduledFor: "scheduled_for",
  scheduledTime: "scheduled_time",
};

export function useOrders() {
  const { rows, loading, reload } = useRealtimeTable({
    table: "orders",
    mapRow: mapOrderRow,
    orderColumn: "created_at",
    orderAscending: true,
  });
  return { orders: rows, loading, reload };
}

export async function insertOrder(order) {
  const { error } = await supabase.from("orders").insert({
    items: order.items,
    service_type: order.serviceType,
    name: order.name,
    slot_allocations: order.slotAllocations || [],
    pizza_count: order.pizzaCount,
    total: order.total,
    status: order.status || "attente",
    apero_status: order.aperoStatus ?? null,
    scheduled_for: order.scheduledFor ?? null,
    scheduled_time: order.scheduledTime ?? null,
  });
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
  const { rows, loading, reload } = useRealtimeTable({ table: "slots", mapRow: mapSlotRow });
  return { slots: rows, loading, reload };
}

export async function insertSlot({ label, capacity }) {
  const { error } = await supabase.from("slots").upsert({ label, capacity }, { onConflict: "label" });
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
      list.map(({ label, capacity }) => ({ label, capacity })),
      { onConflict: "label" }
    );
  if (error) throw error;
}

// -------------------------------------------------------------- ruptures --

export function useRuptures() {
  const { rows, loading, reload } = useRealtimeTable({ table: "ruptures", mapRow: (r) => r.item_id });
  return { ruptures: rows, loading, reload };
}

export async function addRupture(itemId) {
  const { error } = await supabase.from("ruptures").upsert({ item_id: itemId });
  if (error) throw error;
}

export async function removeRupture(itemId) {
  const { error } = await supabase.from("ruptures").delete().eq("item_id", itemId);
  if (error) throw error;
}

// ---------------------------------------------------------- dessert_stock --

export function useDessertStock() {
  const { rows, loading, reload } = useRealtimeTable({ table: "dessert_stock", mapRow: (r) => r });
  const dessertStock = Object.fromEntries(rows.map((r) => [r.key, r.qty]));
  return { dessertStock, loading, reload };
}

export async function setDessertStockQty(key, qty) {
  const { error } = await supabase.from("dessert_stock").upsert({ key, qty });
  if (error) throw error;
}

// ----------------------------------------------------- custom_menu_items --

function mapCustomMenuItemRow(row) {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    cat: row.cat,
    ingredients: row.ingredients || undefined,
    photoUrl: row.photo_url || null,
  };
}

export function useCustomMenuItems() {
  const { rows, loading, reload } = useRealtimeTable({
    table: "custom_menu_items",
    mapRow: mapCustomMenuItemRow,
    orderColumn: "created_at",
  });
  return { customMenuItems: rows, loading, reload };
}

export async function insertCustomMenuItem({ name, price, cat, ingredients, photoUrl }) {
  const { error } = await supabase.from("custom_menu_items").insert({
    name,
    price,
    cat,
    ingredients: ingredients ?? null,
    photo_url: photoUrl ?? null,
  });
  if (error) throw error;
}

export async function deleteCustomMenuItem(id) {
  const { error } = await supabase.from("custom_menu_items").delete().eq("id", id);
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
  const { rows, loading, reload } = useRealtimeTable({ table: "table_plan", mapRow: mapTablePlanRow });
  return { tablePlan: rows[0] || EMPTY_PLAN, loading, reload };
}

export async function saveTablePlan(plan) {
  const { error } = await supabase
    .from("table_plan")
    .update({ default_layout: plan.defaultLayout, current_layout: plan.currentLayout })
    .eq("id", 1);
  if (error) throw error;
}

// ------------------------------------------------------------- team_config --

export function useTeamPin() {
  const { rows, loading, reload } = useRealtimeTable({ table: "team_config", mapRow: (r) => r.pin });
  return { pin: rows[0] || "0505", loading, reload };
}

export async function setTeamPin(pin) {
  const { error } = await supabase.from("team_config").update({ pin }).eq("id", 1);
  if (error) throw error;
}
