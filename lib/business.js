// Logique métier pure — portée telle quelle depuis borne-casa-di-nathano.jsx.
// Aucune dépendance au stockage : ces fonctions manipulent des objets déjà
// chargés en mémoire (orders, slots, dessertStock...) au format camelCase
// utilisé dans toute l'UI. La conversion vers/depuis les colonnes snake_case
// de Postgres se fait dans lib/data/*.js, pas ici.

import { DESSERT_TAKEAWAY_FALLBACK_NOTE } from "./menu";

// Ancien type de service (tables réservées à l'avance, capacité retirée
// manuellement des créneaux) — retiré du choix à la prise de commande, les
// commandes "sur place" réservent maintenant automatiquement leur créneau.
// Conservé uniquement pour l'affichage des commandes historiques.
export const RESERVED_SERVICE_TYPE = "🍽️ Sur place déjà réservé";

// Utilisé pour masquer les produits "sur place uniquement" (glaces, Paris
// Palerme...) de la borne/équipe quand ce type de service est sélectionné.
export const TAKEAWAY_SERVICE_TYPE = "🥡 À emporter";

// Client de passage pressé : la prise de commande serveuses uniquement.
// Aucun créneau réservé (la pizza part dès que le four a une minute), donc
// aucun décompte sur les créneaux du jour — juste sur le stock de pâtons.
export const IMMEDIATE_TAKEAWAY_SERVICE_TYPE = "🥡 À emporter tout de suite";

export function isTakeawayLike(serviceType) {
  return serviceType === TAKEAWAY_SERVICE_TYPE || serviceType === IMMEDIATE_TAKEAWAY_SERVICE_TYPE;
}

export function serviceTypeBadgeStyle(serviceType) {
  if (serviceType === IMMEDIATE_TAKEAWAY_SERVICE_TYPE) return { background: "#5a2a0a", color: "#f0a860" };
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

// Une ligne notée DESSERT_TAKEAWAY_FALLBACK_NOTE est un dessert sur place
// dépanné avec un contenant à emporter (voir dessertHasSeparateFormats) — son
// format réel est "à emporter" quel que soit le type de la commande, pour que
// le décompte impute la bonne case de stock.
function isTakeawayFormatItem(it, order) {
  if (it.note === DESSERT_TAKEAWAY_FALLBACK_NOTE) return true;
  return isTakeawayLike(order.serviceType);
}

export function remainingForDessertGroup(orders, dessertStock, group) {
  const made = dessertStock[group.key] || 0;
  const used = orders
    .filter((o) => !o.isTest)
    .flatMap((o) => o.items.map((it) => ({ it, o })))
    .filter(({ it }) => group.itemNames.includes(it.name))
    .filter(({ it, o }) => !group.scope || (group.scope === "takeaway") === isTakeawayFormatItem(it, o))
    .reduce((s, { it }) => s + it.qty, 0);
  return made - used;
}

// Groupe de stock à considérer pour un dessert donné, en tenant compte du
// format de service en cours (un même nom d'article peut correspondre à deux
// groupes distincts — sur place / à emporter — quand ils sont préparés dans
// des contenants différents ; sinon un seul groupe partagé, sans `scope`).
export function dessertStockGroupFor(groups, name, isTakeaway) {
  const candidates = groups.filter((g) => g.itemNames.includes(name));
  if (candidates.length <= 1) return candidates[0] || null;
  return candidates.find((g) => (g.scope === "takeaway") === isTakeaway) || null;
}

// Vrai pour un dessert qui a deux groupes de stock distincts (sur place et à
// emporter, contenants différents) — seuls ceux-là sont éligibles au
// dépannage à emporter quand le format sur place est épuisé. Faux pour un
// dessert à contenant unique (ex. Paris Palerme, un seul groupe partagé).
export function dessertHasSeparateFormats(groups, name) {
  const dineIn = dessertStockGroupFor(groups, name, false);
  const takeaway = dessertStockGroupFor(groups, name, true);
  return Boolean(dineIn && takeaway && dineIn !== takeaway);
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
// Une commande payée d'avance (bouton "Payée, non servie" en Caisse) garde
// son statut habituel tant qu'elle n'est pas terminée — seul `paid` change,
// pour ne pas la faire disparaître à tort des écrans équipe. Une commande
// passée directement en status "servie" (le cas normal, paiement à la fin)
// est donc payée elle aussi, même si `paid` n'a jamais été mis à jour
// explicitement pour elle.
export function isOrderPaid(order) {
  return !!order.paid || order.status === "servie";
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

// Grille standard des créneaux (mêmes horaires que la génération automatique
// nocturne, voir supabase/schema.sql) — utilisée là où on a besoin de
// proposer un horaire sans dépendre des vrais créneaux du jour (ex. une
// commande programmée pour un autre jour, où les créneaux réels n'existent pas encore).
function labelRange(start, end, step) {
  const labels = [];
  for (let t = parseMinutes(start); t <= parseMinutes(end); t += step) {
    labels.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  return labels;
}
export const MIDI_SLOT_LABELS = labelRange("12:00", "15:00", 10);
export const SOIR_SLOT_LABELS = labelRange("18:00", "24:00", 10);

export function minutesFromNow(label) {
  const mins = parseMinutes(label);
  if (mins === null) return null;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return Math.max(0, mins - nowMinutes);
}

function realUsedForSlot(orders, slotId) {
  return orders
    .filter((o) => o.status !== "servie" && !o.isTest)
    .flatMap((o) => o.slotAllocations || [])
    .filter((a) => a.slotId === slotId)
    .reduce((s, a) => s + a.qty, 0);
}

// Répartit `needed` unités à rebours depuis `targetLabel`, qui reste le
// dernier créneau de la série (comme buildPlans le ferait en partant du plus
// tôt, mais ancré sur un horaire précis plutôt que sur "le plus proche
// disponible") : on remplit la capacité encore libre — au sens des seules
// VRAIES réservations de `orders`, voir withVirtualScheduledAllocations pour
// tenir compte aussi des autres commandes programmées — de chaque créneau
// précédent jusqu'à couvrir tout le besoin. Reste interne : n'importe quel
// appelant externe doit passer par backwardFillPlanWithScheduled ci-dessous.
function backwardFillPlan(orders, allSlots, targetLabel, needed) {
  if (needed <= 0 || !allSlots || allSlots.length === 0) return [];
  const sortedSlots = [...allSlots].filter((s) => parseMinutes(s.label) !== null).sort((a, b) => parseMinutes(a.label) - parseMinutes(b.label));
  const targetIdx = sortedSlots.findIndex((s) => s.label === targetLabel);
  if (targetIdx === -1) return [];
  const plan = [];
  let left = needed;
  for (let idx = targetIdx; idx >= 0 && left > 0; idx--) {
    const slot = sortedSlots[idx];
    const remaining = slot.capacity - realUsedForSlot(orders, slot.id);
    if (remaining <= 0) continue;
    const take = Math.min(remaining, left);
    plan.push({ slotId: slot.id, label: slot.label, qty: take });
    left -= take;
    // Si la capacité cumulée jusqu'au début du service ne suffit toujours
    // pas, le reliquat n'est simplement pas compté — comme pour toute
    // commande dont la taille dépasse ce que le four peut absorber.
  }
  return plan.sort((a, b) => (parseMinutes(a.label) ?? 0) - (parseMinutes(b.label) ?? 0));
}

// Une commande programmée la veille (ou plus tôt) pour un créneau précis n'a
// jamais réservé de vraies places : les créneaux du jour visé n'existaient
// pas encore à sa création (voir ScheduledOrderFlow, qui se contente de
// retenir l'horaire souhaité). Dès que son jour arrive, on lui reconstitue —
// pour chacune, dans l'ordre où elles ont été passées — la répartition
// qu'elle aurait obtenue en visant ce créneau aujourd'hui. Chaque résultat
// compte comme réel pour la suivante (premier arrivé, premier servi).
function virtualScheduledAllocations(orders, allSlots) {
  const active = orders.filter((o) => o.status !== "servie" && !o.isTest);
  const scheduledPending = active
    .filter((o) => (!o.slotAllocations || o.slotAllocations.length === 0) && o.scheduledTime && isOrderActiveToday(o) && o.pizzaCount > 0)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  if (scheduledPending.length === 0) return [];

  const virtual = [];
  let ordersSoFar = orders;
  for (const o of scheduledPending) {
    const plan = backwardFillPlan(ordersSoFar, allSlots, o.scheduledTime, o.pizzaCount);
    if (plan.length === 0) continue;
    plan.forEach((p) => virtual.push({ orderId: o.id, ...p }));
    ordersSoFar = ordersSoFar.concat([{ id: `__virtual_${o.id}__`, status: "attente", isTest: false, slotAllocations: plan }]);
  }
  return virtual;
}

// `orders`, avec toute commande programmée en attente de créneau réel dotée
// temporairement de sa répartition virtuelle — pour qu'un calcul de capacité
// (nouvelle réservation, ré-édition d'une AUTRE commande programmée) en
// tienne compte sans avoir à connaître ce détail.
function withVirtualScheduledAllocations(orders, allSlots) {
  const virtual = virtualScheduledAllocations(orders, allSlots);
  if (virtual.length === 0) return orders;
  const byOrder = new Map();
  for (const v of virtual) {
    if (!byOrder.has(v.orderId)) byOrder.set(v.orderId, []);
    byOrder.get(v.orderId).push({ slotId: v.slotId, label: v.label, qty: v.qty });
  }
  return orders.map((o) => (byOrder.has(o.id) ? { ...o, slotAllocations: byOrder.get(o.id) } : o));
}

// Regroupe virtualScheduledAllocations par commande, au format `slotAllocations`
// standard — utilisé pour persister pour de bon la répartition d'une commande
// programmée dès qu'un écran équipe la recalcule (voir TeamSpace), afin
// qu'elle s'affiche partout comme n'importe quelle grosse commande répartie
// sur plusieurs créneaux, au lieu de rester affichée sur son seul horaire visé.
export function computeScheduledOrderSlotAllocations(orders, allSlots) {
  const byOrder = new Map();
  for (const v of virtualScheduledAllocations(orders, allSlots)) {
    if (!byOrder.has(v.orderId)) byOrder.set(v.orderId, []);
    byOrder.get(v.orderId).push({ slotId: v.slotId, label: v.label, qty: v.qty });
  }
  return Array.from(byOrder, ([orderId, slotAllocations]) => ({ orderId, slotAllocations }));
}

// Recalcule la répartition de toute commande programmée active aujourd'hui
// et PAS ENCORE ENFOURNÉE (status "attente") — qu'elle ait déjà une
// répartition enregistrée ou non — pour que tout changement de capacité
// d'un créneau (le pizzaiolo qui ajuste "Créneaux du jour" en cours de
// service) s'y répercute automatiquement. Une commande déjà envoyée au four
// n'est jamais recalculée : la répartition, une fois la cuisson lancée,
// reflète une réalité physique qu'aucun ajustement logiciel ne doit
// bousculer. Ne renvoie que les commandes dont le résultat frais diffère
// réellement de ce qui est déjà enregistré, pour éviter des écritures
// inutiles à chaque rendu.
export function recomputeScheduledOrderSlotAllocations(orders, allSlots) {
  const eligible = orders
    .filter((o) => o.status === "attente" && !o.isTest && o.scheduledTime && isOrderActiveToday(o) && o.pizzaCount > 0)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  if (eligible.length === 0) return [];

  const eligibleIds = new Set(eligible.map((o) => o.id));
  // Les commandes concernées repartent sans réservation dans la base de
  // calcul, pour être réattribuées une à une ci-dessous ; les autres
  // gardent leurs vraies réservations telles quelles.
  let baseline = orders.map((o) => (eligibleIds.has(o.id) ? { ...o, slotAllocations: [] } : o));

  const results = [];
  for (const o of eligible) {
    const otherOrders = baseline.filter((x) => x.id !== o.id);
    const plan = backwardFillPlan(otherOrders, allSlots, o.scheduledTime, o.pizzaCount);
    const current = o.slotAllocations || [];
    const unchanged =
      plan.length === current.length &&
      plan.every((a) => current.some((b) => b.slotId === a.slotId && b.qty === a.qty));
    if (!unchanged) results.push({ orderId: o.id, slotAllocations: plan });
    baseline = baseline.map((x) => (x.id === o.id ? { ...x, slotAllocations: plan } : x));
  }
  return results;
}

// Version publique de backwardFillPlan pour un appelant externe (ex.
// EditOrderModal, en repartant du créneau visé d'une commande programmée
// après une modification) — tient compte des autres commandes programmées en
// attente de créneau réel, en plus des vraies réservations.
export function backwardFillPlanWithScheduled(orders, allSlots, targetLabel, needed) {
  return backwardFillPlan(withVirtualScheduledAllocations(orders, allSlots), allSlots, targetLabel, needed);
}

export function remainingForSlot(orders, slot, allSlots) {
  return slot.capacity - realUsedForSlot(withVirtualScheduledAllocations(orders, allSlots), slot.id);
}

// Répartit `needed` unités en avançant depuis `anchorLabel` (premier créneau
// de la série) vers les créneaux suivants — miroir de backwardFillPlan, pour
// les commandes prises "maintenant" (à emporter classique, sur place) dont la
// série a toujours commencé au créneau le plus proche déjà accordé (pas un
// horaire cible choisi à l'avance comme pour les commandes programmées). Si
// un créneau de la chaîne est déjà plein (par une autre commande) ou que la
// capacité totale ne suffit plus depuis l'ancre, on abandonne (tableau vide)
// plutôt que de proposer une répartition partielle.
function forwardFillPlan(orders, allSlots, anchorLabel, needed) {
  if (needed <= 0 || !allSlots || allSlots.length === 0) return [];
  const sortedSlots = [...allSlots].filter((s) => parseMinutes(s.label) !== null).sort((a, b) => parseMinutes(a.label) - parseMinutes(b.label));
  const anchorIdx = sortedSlots.findIndex((s) => s.label === anchorLabel);
  if (anchorIdx === -1) return [];
  const plan = [];
  let left = needed;
  for (let idx = anchorIdx; idx < sortedSlots.length && left > 0; idx++) {
    const slot = sortedSlots[idx];
    const remaining = slot.capacity - realUsedForSlot(orders, slot.id);
    if (remaining <= 0) return [];
    const take = Math.min(remaining, left);
    plan.push({ slotId: slot.id, label: slot.label, qty: take });
    left -= take;
  }
  return left === 0 ? plan : [];
}

// Recalcule la répartition de toute commande déjà réservée sur un ou
// plusieurs créneaux réels (à emporter classique, sur place) et PAS ENCORE
// ENFOURNÉE (status "attente") — pour que tout changement de capacité d'un
// créneau en cours de service (SlotsAdmin) s'y répercute automatiquement,
// exactement comme pour les commandes programmées (voir
// recomputeScheduledOrderSlotAllocations ci-dessus). L'ancre reste le PREMIER
// créneau déjà accordé (le plus proche au moment de la commande, ou choisi à
// la main par l'équipe) : on ne fait que ré-optimiser combien de pizzas vont
// dans chaque créneau de la série, jamais avancer ou retarder son point de
// départ. Les commandes forcées (slotForced) sont laissées intactes : un
// forçage est une décision manuelle avec le pizzaiolo, qu'un recalcul
// automatique ne doit pas défaire.
export function recomputeImmediateOrderSlotAllocations(orders, allSlots) {
  const eligible = orders
    .filter(
      (o) =>
        o.status === "attente" &&
        !o.isTest &&
        !o.scheduledTime &&
        !o.slotForced &&
        o.pizzaCount > 0 &&
        o.slotAllocations &&
        o.slotAllocations.length > 0 &&
        isOrderActiveToday(o)
    )
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  if (eligible.length === 0) return [];

  const eligibleIds = new Set(eligible.map((o) => o.id));
  let baseline = orders.map((o) => (eligibleIds.has(o.id) ? { ...o, slotAllocations: [] } : o));

  const results = [];
  for (const o of eligible) {
    const otherOrders = baseline.filter((x) => x.id !== o.id);
    const anchorLabel = o.slotAllocations[0].label;
    const plan = forwardFillPlan(otherOrders, allSlots, anchorLabel, o.pizzaCount);
    const finalPlan = plan.length > 0 ? plan : o.slotAllocations;
    const current = o.slotAllocations;
    const unchanged =
      finalPlan.length === current.length && finalPlan.every((a) => current.some((b) => b.slotId === a.slotId && b.qty === a.qty));
    if (!unchanged) results.push({ orderId: o.id, slotAllocations: finalPlan });
    baseline = baseline.map((x) => (x.id === o.id ? { ...x, slotAllocations: finalPlan } : x));
  }
  return results;
}

// Découpe automatique sur des créneaux qui se suivent strictement — jamais de
// créneau sauté. Retourne TOUTES les combinaisons valides (une par point de
// départ possible), pas juste la première — pour permettre au client de
// choisir une répartition plus tardive, comme pour les créneaux simples.
// `marginMinutes` écarte les créneaux trop proches (voir computeSlotOptions).
export function buildPlans(orders, slots, needed, marginMinutes = 0) {
  if (needed === 0) return [];
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const upcoming = slots
    .map((s) => ({ ...s, mins: parseMinutes(s.label), remaining: remainingForSlot(orders, s, slots) }))
    .filter((s) => s.mins !== null && s.mins >= nowMinutes + marginMinutes)
    .sort((a, b) => a.mins - b.mins);

  const plans = [];
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
    if (left === 0 && candidate.length > 0) plans.push(candidate);
  }
  return plans;
}

// Calcule les options de créneau à proposer au client :
// - s'il existe au moins un créneau seul capable d'absorber toute la commande, on les liste tous (le plus proche en premier)
// - sinon, on liste toutes les répartitions possibles sur plusieurs créneaux consécutifs (plans[])
// `marginMinutes` (à emporter uniquement, voir TAKEAWAY_SLOT_MARGIN_MINUTES)
// écarte les créneaux trop proches pour laisser au four le temps de s'organiser
// avant l'échéance — ex. 7 min : à 18h54 le créneau 19h00 n'est plus proposé,
// on passe directement à 19h10. Le sur place n'utilise jamais cette marge (le
// client est déjà à table, il reçoit le créneau en cours quoi qu'il arrive).
export function computeSlotOptions(orders, slots, needed, marginMinutes = 0) {
  if (needed === 0) return { mode: "single", options: [] };
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const upcoming = slots
    .map((s) => ({ ...s, mins: parseMinutes(s.label), remaining: remainingForSlot(orders, s, slots) }))
    .filter((s) => s.mins !== null && s.mins >= nowMinutes + marginMinutes)
    .sort((a, b) => a.mins - b.mins);

  const singleFits = upcoming.filter((s) => s.remaining >= needed);
  if (singleFits.length > 0) return { mode: "single", options: singleFits };

  const plans = buildPlans(orders, slots, needed, marginMinutes);
  if (plans.length > 0) return { mode: "split", plans };
  return { mode: "none" };
}

// Marge appliquée aux créneaux "à emporter" (borne, lien en ligne, prise de
// commande serveuses) pour que le four ne se retrouve jamais avec des pizzas
// à sortir dans l'instant — voir computeSlotOptions.
export const TAKEAWAY_SLOT_MARGIN_MINUTES = 7;

// Vue "équipe" de tous les créneaux à venir, y compris ceux déjà pleins
// théoriquement (remaining < needed) — utilisée uniquement côté serveuses pour
// leur permettre de forcer un créneau plein avec l'accord du pizzaiolo (celui-ci
// estime parfois trop bas sa capacité en début de service). Le client final ne
// voit jamais cette liste : computeSlotOptions reste inchangée pour la borne et
// le lien à emporter.
export function allUpcomingSlotsForStaff(orders, slots, needed) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return slots
    .map((s) => ({ id: s.id, label: s.label, mins: parseMinutes(s.label), remaining: remainingForSlot(orders, s, slots) }))
    .filter((s) => s.mins !== null && s.mins > nowMinutes)
    .sort((a, b) => a.mins - b.mins)
    .map(({ id, label, remaining }) => ({ id, label, remaining, full: remaining < needed }));
}

// Dérive directement le plan le plus proche d'un résultat de
// computeSlotOptions, sans passer par l'écran de choix — utilisé pour les
// commandes "sur place", réservées automatiquement sur le créneau en cours
// plutôt que choisies à la main (le client est déjà assis, inutile de lui
// communiquer un horaire).
export function earliestSlotPlan(slotChoice, needed) {
  if (!slotChoice) return null;
  if (slotChoice.mode === "single" && slotChoice.options && slotChoice.options.length > 0) {
    const s = slotChoice.options[0];
    return [{ slotId: s.id, label: s.label, qty: needed }];
  }
  if (slotChoice.mode === "split" && slotChoice.plans && slotChoice.plans.length > 0) {
    return slotChoice.plans[0];
  }
  return null;
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

// Tri "naturel" par numéro/nom de table — "2" avant "10" (pas l'ordre
// alphabétique brut), et les noms non numériques triés alphabétiquement.
// Utilisé pour retrouver une table au coup d'œil (bandeau Service, Caisse).
const tableNameCollator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });
export function sortByTableName(list) {
  return [...list].sort((a, b) => tableNameCollator.compare(a.name || "", b.name || ""));
}

// Affichage du créneau sur les tickets/cartes équipe — "19:20" tout court
// pour le cas courant (une seule pizza sur ce créneau), "3×19:20" seulement
// quand la quantité apporte une vraie information.
export function formatSlotAllocations(slotAllocations) {
  return (slotAllocations || []).map((a) => (a.qty > 1 ? `${a.qty}×${a.label}` : a.label)).join(" + ");
}

// Regroupement des articles sur les écrans Service/Caisse — boissons
// d'abord (pour que le service à table sache quoi prendre en premier), puis
// antipasti, puis les plats (pizzas/panuzzo/salades), puis les desserts, et
// enfin les boissons chaudes (souvent commandées après le dessert).
// Retourne un tableau de groupes non vides, pour permettre d'afficher un
// séparateur visuel entre chacun (repérage rapide en plein rush).
const ITEM_DISPLAY_GROUPS = [
  ["boisson", "biere", "vin", "cocktail"],
  ["antipasti"],
  ["pizza", "panuzzo", "salade", "supplement", "sans"],
  ["dessert"],
  ["cafe"],
];
export function groupItemsForDisplay(items) {
  const list = items || [];
  return ITEM_DISPLAY_GROUPS.map((cats) => list.filter((it) => cats.includes(it.cat))).filter((g) => g.length > 0);
}

// File du four : les commandes à emporter d'abord (les "tout de suite" tout
// devant, avant même les à emporter classiques), puis le sur place en
// dessous — chaque ligne triée par créneau, puisque les commandes sur place
// réservent maintenant elles aussi automatiquement leur créneau.
function kitchenQueuePriority(o) {
  if (o.serviceType === IMMEDIATE_TAKEAWAY_SERVICE_TYPE) return 0;
  if (o.serviceType === TAKEAWAY_SERVICE_TYPE) return 1;
  return 2;
}
export function sortKitchenQueue(list) {
  return [...list].sort((a, b) => {
    const pa = kitchenQueuePriority(a);
    const pb = kitchenQueuePriority(b);
    if (pa !== pb) return pa - pb;
    if (pa === 0) return a.createdAt - b.createdAt;
    return orderSortMinutes(a) - orderSortMinutes(b);
  });
}

// Échéance visée par une commande côté four (dernier créneau réservé si elle
// en occupe plusieurs, sinon l'horaire programmé) — sert de référence au
// chrono du four : compte à rebours avant, retard décompté après. `null` si
// la commande ne vise aucune heure précise (ex. à emporter tout de suite).
export function orderDeadlineMinutes(order) {
  if (order.slotAllocations && order.slotAllocations.length > 0) {
    const mins = order.slotAllocations.map((a) => parseMinutes(a.label)).filter((m) => m !== null);
    if (mins.length > 0) return Math.max(...mins);
  }
  if (order.scheduledTime) {
    const mins = parseMinutes(order.scheduledTime);
    if (mins !== null) return mins;
  }
  return null;
}

// Chronomètres four/finition — affichage discret, pas d'alerte ni de couleur d'urgence.
export function formatDurationShort(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}
// Format chrono qui défile seconde par seconde (m:ss, ou h:mm:ss au-delà d'une heure).
export function formatStopwatch(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
export function formatDurationPrecise(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m} min ${String(s).padStart(2, "0")}s`;
}
