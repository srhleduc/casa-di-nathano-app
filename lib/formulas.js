// Logique pure des formules (ex. « La Formule Casa » 20 € = pizza + dessert +
// soda) : disponibilité selon le restaurant, le mode (sur place / à emporter)
// et le service de la semaine, puis transformation d'un choix client en lignes
// de panier. Aucune I/O — les formules elles-mêmes vivent en base (table
// `formulas`, voir lib/data.js#useFormulas) et s'éditent dans Direction →
// Formules.

import { PANUZZO_CUTOFF_HOUR } from "./menu.js";

// 0 = dimanche … 6 = samedi (= Date.getDay()), affichés du lundi au dimanche.
export const WEEK_DAYS = [
  { dow: 1, label: "Lundi", short: "Lun" },
  { dow: 2, label: "Mardi", short: "Mar" },
  { dow: 3, label: "Mercredi", short: "Mer" },
  { dow: 4, label: "Jeudi", short: "Jeu" },
  { dow: 5, label: "Vendredi", short: "Ven" },
  { dow: 6, label: "Samedi", short: "Sam" },
  { dow: 0, label: "Dimanche", short: "Dim" },
];
export const SERVICE_GROUPS = [
  { key: "midi", label: "Midi", emoji: "☀️" },
  { key: "soir", label: "Soir", emoji: "🌙" },
];

// Clé d'un service de la semaine : "1-midi" = lundi midi.
export const serviceSlotKey = (dow, group) => `${dow}-${group}`;
export const ALL_SERVICE_SLOTS = WEEK_DAYS.flatMap((d) => SERVICE_GROUPS.map((g) => serviceSlotKey(d.dow, g.key)));

// Groupe de service « en cours » à une date donnée : midi avant la coupure
// (même coupure que le reste de l'app, PANUZZO_CUTOFF_HOUR), soir ensuite.
export function currentServiceGroup(date = new Date(), cutoffHour = PANUZZO_CUTOFF_HOUR) {
  return date.getHours() < cutoffHour ? "midi" : "soir";
}

// La formule est-elle proposée maintenant ? `isTakeaway` = commande à emporter
// (click & collect, borne à emporter…) sinon sur place. `restaurantId` null
// (déploiement sans restaurant) → on ne filtre pas par restaurant.
export function isFormulaAvailable(formula, { restaurantId, isTakeaway, date = new Date() } = {}) {
  if (!formula || formula.active === false) return false;
  if (isTakeaway ? !formula.takeaway : !formula.dineIn) return false;
  const ids = formula.restaurantIds || [];
  if (restaurantId && ids.length > 0 && !ids.includes(restaurantId)) return false;
  return (formula.serviceSlots || []).includes(serviceSlotKey(date.getDay(), currentServiceGroup(date)));
}

// Produits proposables dans un emplacement : ceux qui existent encore au menu
// ET que `isOrderable(item)` accepte (rupture, stock, sur place/à emporter…).
// Renvoie [{ item, supplement }] dans l'ordre configuré.
export function slotChoices(slot, menuById, isOrderable = () => true) {
  const out = [];
  for (const entry of slot?.items || []) {
    const item = menuById.get(entry.itemId);
    if (!item || !isOrderable(item)) continue;
    out.push({ item, supplement: Math.max(0, Number(entry.supplement) || 0) });
  }
  return out;
}

// Une formule n'est commandable que si chacun de ses emplacements a au moins
// un produit disponible (sinon le client resterait bloqué à mi-parcours).
export function isFormulaOrderable(formula, menuById, isOrderable) {
  const slots = formula?.slots || [];
  return slots.length > 0 && slots.every((s) => slotChoices(s, menuById, isOrderable).length > 0);
}

// Plus petit prix possible (« à partir de ») — le prix de base de la formule ;
// les suppléments ne s'ajoutent que si le client choisit un produit à supplément.
export const formulaStartingPrice = (formula) => Number(formula?.price) || 0;

// Lignes de panier d'une formule : le 1er emplacement porte le prix de la
// formule (+ son éventuel supplément), les autres ne portent que leur
// supplément (0 = inclus) — même représentation que l'ancienne formule du
// midi, pour que les totaux et les tickets restent inchangés.
// `picks` : [{ item, supplement }] dans l'ordre des emplacements.
// `fmt` : formatteur d'euros pour la note (ex. eur de lib/menu).
export function formulaCartLines(formula, picks, fmt = (n) => String(n)) {
  return picks.map(({ item, supplement }, idx) => {
    const sup = Math.max(0, Number(supplement) || 0);
    const base = idx === 0 ? Number(formula.price) || 0 : 0;
    const note =
      idx === 0
        ? sup > 0
          ? `${formula.name} +${fmt(sup)}`
          : `${formula.name}`
        : sup > 0
        ? `${formula.name} +${fmt(sup)}`
        : `${formula.name} (inclus)`;
    return { item: { ...item, price: Math.round((base + sup) * 100) / 100 }, note };
  });
}

// Résumé lisible de la disponibilité d'une formule pour la liste admin.
export function summarizeServiceSlots(serviceSlots) {
  const set = new Set(serviceSlots || []);
  if (set.size === 0) return "Aucun service";
  if (ALL_SERVICE_SLOTS.every((k) => set.has(k))) return "Tous les services";
  const parts = [];
  for (const d of WEEK_DAYS) {
    const m = set.has(serviceSlotKey(d.dow, "midi"));
    const s = set.has(serviceSlotKey(d.dow, "soir"));
    if (m && s) parts.push(d.short);
    else if (m) parts.push(`${d.short} midi`);
    else if (s) parts.push(`${d.short} soir`);
  }
  return parts.join(" · ");
}
