// Logique métier pure — portée telle quelle depuis borne-casa-di-nathano.jsx.
// Aucune dépendance au stockage : ces fonctions manipulent des objets déjà
// chargés en mémoire (orders, slots, dessertStock...) au format camelCase
// utilisé dans toute l'UI. La conversion vers/depuis les colonnes snake_case
// de Postgres se fait dans lib/data/*.js, pas ici.

// Type de service utilisé par la prise de commande en salle pour les tables
// qui avaient réservé avant le service : la capacité de leurs pizzas a déjà
// été retirée à l'avance des créneaux (manuellement, côté Logistique), donc
// ces commandes ne doivent pas être décomptées une deuxième fois.
export const RESERVED_SERVICE_TYPE = "🍽️ Sur place déjà réservé";
export const RESERVED_SERVICE_NOTE =
  "Les pizzas de cette catégorie ont déjà été décomptées et ne le seront pas de nouveau. Car certaines tables réservent avant le service et nous avons besoin de préparer à l'avance une disponibilité pour leurs pizzas sur nos créneaux.";

export function serviceTypeBadgeStyle(serviceType) {
  if (serviceType === RESERVED_SERVICE_TYPE) return { background: "#204a3a", color: "#a8e8c8" };
  if (serviceType === "🍽️ Sur place") return { background: "#2c3e50", color: "#a8c8e8" };
  return { background: "#4a2c3e", color: "#e8a8c8" };
}

export function cartSignature(id, note, modifiers) {
  const modKey = (modifiers || []).map((m) => m.name).sort().join(",");
  return `${id}|${note || ""}|${modKey}`;
}

export function lineUnitPrice(item) {
  return item.price + (item.modifiers || []).reduce((s, m) => s + m.price, 0);
}

export function withAutoFocaccia(next, item, phase, menu) {
  if (!item.name.startsWith("Planche")) return next;
  const focaccia = (menu || []).find((m) => m.name === "Focaccia");
  if (!focaccia) return next;
  const existing = next.find((i) => i.id === focaccia.id && !i.note && i.phase === phase);
  if (existing) return next.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i));
  return [...next, { ...focaccia, qty: 1, note: null, phase }];
}

export function remainingForDessertGroup(orders, dessertStock, group) {
  const made = dessertStock[group.key] || 0;
  const used = orders
    .filter((o) => !o.isTest)
    .flatMap((o) => o.items)
    .filter((it) => group.itemNames.includes(it.name))
    .reduce((s, it) => s + it.qty, 0);
  return made - used;
}

// Décompte de pâtons du soir — total non configuré (0) = pas de limite.
// Compte toutes les pizzas des commandes actives du jour, quel que soit leur
// statut (une pizza déjà servie a quand même consommé un pâton). Les commandes
// du mode test n'entament jamais le vrai stock.
export function remainingPizzaStock(orders, pizzaStock) {
  const total = (pizzaStock && pizzaStock.total) || 0;
  if (total <= 0) return Infinity;
  const used = orders
    .filter((o) => isOrderActiveToday(o) && !o.isTest)
    .reduce((s, o) => s + (o.pizzaCount || 0), 0);
  return total - ((pizzaStock && pizzaStock.safetyMargin) || 0) - used;
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function dateStrFromTimestamp(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function isOrderFromPastAndStale(order) {
  const isFromToday = dateStrFromTimestamp(order.createdAt) === todayStr();
  return !isFromToday && !isOrderScheduledLater(order);
}
export function isOrderActiveToday(order) {
  return !order.scheduledFor || order.scheduledFor === todayStr();
}
export function isOrderScheduledLater(order) {
  return !!order.scheduledFor && order.scheduledFor !== todayStr();
}
export function formatFrenchDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export function parseMinutes(label) {
  const m = String(label).match(/(\d{1,2})[:h](\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function minutesFromNow(label) {
  const mins = parseMinutes(label);
  if (mins === null) return null;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return Math.max(0, mins - nowMinutes);
}

export function remainingForSlot(orders, slot) {
  const used = orders
    .filter((o) => o.status !== "servie" && !o.isTest)
    .flatMap((o) => o.slotAllocations || [])
    .filter((a) => a.slotId === slot.id)
    .reduce((s, a) => s + a.qty, 0);
  return slot.capacity - used;
}

// Découpe automatique sur des créneaux qui se suivent strictement — jamais de créneau sauté.
export function buildPlan(orders, slots, needed) {
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
export function computeSlotOptions(orders, slots, needed) {
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

export function orderSortMinutes(order) {
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
export function sortOrdersByTime(list) {
  return [...list].sort((a, b) => orderSortMinutes(a) - orderSortMinutes(b));
}

// Chronomètres four/finition — affichage discret, pas d'alerte ni de couleur d'urgence.
export function formatDurationShort(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}
export function formatDurationPrecise(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m} min ${String(s).padStart(2, "0")}s`;
}
