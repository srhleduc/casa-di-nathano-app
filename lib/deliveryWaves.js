// Départs de livraison groupés par secteur (un seul livreur) — logique pure,
// sans dépendance, testée par lib/deliveryWaves.test.mjs.
//
// Un « départ » = une heure à laquelle le livreur part avec les commandes
// prêtes d'UN secteur, avec un nombre maximum de commandes. La base
// (supabase/migrations_manual/delivery_waves.sql) fait foi pour le quota ; ce
// module sert à (1) construire la grille de départs proposée par défaut,
// (2) composer, côté client, la liste des départs réellement proposables en
// tenant compte des créneaux four, (3) regrouper les livraisons par départ
// pour l'écran livreur.

export const WAVE_SECTORS = [
  { key: "est", label: "Est" },
  { key: "sud", label: "Sud" },
];

export function sectorLabel(key) {
  return WAVE_SECTORS.find((s) => s.key === key)?.label || "Local";
}

export function parseHHMM(t) {
  const m = String(t ?? "").match(/^(\d{1,2})[:h](\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// Saisie d'une heure au clavier numérique (qui n'a pas la touche « : ») :
// on n'accepte que des chiffres et on insère le « : » tout seul.
// « 2300 » → « 23:00 », « 930 » → « 9:30 ».
export function formatTimeInput(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "").slice(0, 4);
  const hourLen = digits[0] > "2" ? 1 : 2;
  if (digits.length <= hourLen) return digits;
  return `${digits.slice(0, hourLen)}:${digits.slice(hourLen)}`;
}

// Ramène une saisie d'heure à la forme « HH:MM » (celle des créneaux four) :
// « 23 » → « 23:00 », « 9:30 » → « 09:30 », « 23h30 » / « 23.30 » → « 23:30 ».
// Une saisie invalide est renvoyée telle quelle (la validation la signalera).
export function normalizeHHMM(raw) {
  const t = String(raw ?? "").trim().replace(/[.,]/g, ":");
  const hOnly = t.match(/^(\d{1,2})h?$/);
  const mins = parseHHMM(hOnly ? `${hOnly[1]}:00` : t);
  return mins == null ? String(raw ?? "").trim() : formatHHMM(mins);
}

export function formatHHMM(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// Grille par défaut : un départ toutes les `stepMinutes`, de `start` à `end`
// inclus, les secteurs se relayant à tour de rôle.
export function buildWaveSchedule({ start = "18:30", end = "21:00", stepMinutes = 30, capacity = 4, sectors = ["est", "sud"] } = {}) {
  const from = parseHHMM(start);
  const to = parseHHMM(end);
  if (from == null || to == null || !(stepMinutes > 0) || sectors.length === 0) return [];
  const waves = [];
  for (let t = from, i = 0; t <= to; t += stepMinutes, i++) {
    waves.push({ departTime: formatHHMM(t), sector: sectors[i % sectors.length], capacity, active: true });
  }
  return waves;
}

// Départs proposables au client pour une commande de `needed` pizzas.
//
// `waves`        : [{ departTime, sector, remaining }] — `remaining` = places de
//                  livraison restantes (quota), calculé par la base.
// `slots`        : créneaux four du jour [{ id, label, capacity }].
// `remainingFor` : (slot) => places four restantes sur ce créneau.
// `fillPlan`     : (label, needed) => répartition à rebours des pizzas sur les
//                  créneaux précédents, qui se termine à `label` (peut être vide).
// `nowMinutes` / `marginMinutes` : un départ trop proche n'est plus proposé,
//                  pour laisser au four le temps de cuire.
//
// Un départ n'est proposé que si le four peut avoir toutes les pizzas prêtes à
// l'heure du départ SANS dépasser la capacité d'aucun créneau (la base refuse
// sinon, voir check_slot_capacity). Une commande sans pizza (boissons,
// desserts) n'occupe pas le four : seul le quota du départ compte.
export function computeWaveChoice({ waves, slots, needed, nowMinutes, marginMinutes = 0, remainingFor, fillPlan }) {
  const options = [];
  for (const w of [...(waves || [])].sort((a, b) => (parseHHMM(a.departTime) ?? 0) - (parseHHMM(b.departTime) ?? 0))) {
    const mins = parseHHMM(w.departTime);
    if (mins == null || w.remaining <= 0 || mins < nowMinutes + marginMinutes) continue;

    let plan = [];
    if (needed > 0) {
      const slot = (slots || []).find((s) => s.label === w.departTime);
      if (!slot) continue; // pas de créneau four à cette heure-là
      if (remainingFor(slot) >= needed) {
        plan = [{ slotId: slot.id, label: slot.label, qty: needed }];
      } else {
        plan = fillPlan(w.departTime, needed) || [];
        const total = plan.reduce((s, p) => s + p.qty, 0);
        const fits = plan.every((p) => {
          const s = (slots || []).find((x) => x.id === p.slotId);
          return s && p.qty <= remainingFor(s);
        });
        if (plan.length === 0 || total !== needed || !fits) continue;
      }
    }
    options.push({ time: w.departTime, sector: w.sector, remaining: w.remaining, plan });
  }
  return { mode: "waves", options };
}

// Le départ choisi est-il toujours proposé ? (comparaison par heure : stable,
// contrairement à un index dans la liste)
export function isWaveStillOffered(choice, time) {
  return Boolean(choice?.options?.some((o) => o.time === time));
}

// Regroupe les livraisons par départ, dans l'ordre horaire ; les commandes sans
// départ (livraison avant l'activation des départs, ou départs désactivés)
// forment un groupe final « sans départ ».
export function groupByWave(orders) {
  const groups = new Map();
  for (const o of orders || []) {
    const key = o.deliveryWave || "";
    if (!groups.has(key)) groups.set(key, { time: key || null, sector: o.deliverySector || null, orders: [] });
    groups.get(key).orders.push(o);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.time == null) return 1;
    if (b.time == null) return -1;
    return (parseHHMM(a.time) ?? 0) - (parseHHMM(b.time) ?? 0);
  });
}

// Regroupe les livraisons par tournée = restaurant + départ (un livreur peut
// livrer pour les deux restaurants, qui ont chacun leurs départs). Ordre :
// par heure de départ, les livraisons sans départ en dernier.
export function groupByTournee(orders) {
  const groups = new Map();
  for (const o of orders || []) {
    const key = `${o.restaurantId || ""}|${o.deliveryWave || ""}`;
    if (!groups.has(key)) groups.set(key, { key, restaurantId: o.restaurantId || null, time: o.deliveryWave || null, sector: o.deliverySector || null, orders: [] });
    groups.get(key).orders.push(o);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.time == null && b.time != null) return 1;
    if (b.time == null && a.time != null) return -1;
    return (parseHHMM(a.time) ?? 0) - (parseHHMM(b.time) ?? 0) || String(a.restaurantId).localeCompare(String(b.restaurantId));
  });
}

// Lien Google Maps multi-arrêts pour une tournée : les arrêts sont classés du
// plus proche au plus éloigné du restaurant (les pizzas arrivent chaudes en
// premier chez les plus proches), le dernier devient la destination. Google
// Maps accepte 9 étapes intermédiaires au plus. Le classement par distance à
// vol d'oiseau est volontairement simple : il ne remplace pas le coup d'œil du
// livreur, qui peut réordonner les arrêts dans Google Maps.
// `keepOrder` : les commandes sont déjà dans l'ordre voulu (tournée calculée),
// on ne les reclasse pas.
export function buildRouteUrl(orders, { maxStops = 10, keepOrder = false } = {}) {
  const withAddress = (orders || []).filter((o) => o && o.deliveryAddress);
  const stops = (keepOrder ? withAddress : withAddress.sort((a, b) => (a.deliveryDistanceKm ?? 1e9) - (b.deliveryDistanceKm ?? 1e9))).slice(0, maxStops);
  if (stops.length === 0) return null;
  const params = new URLSearchParams({ api: "1", travelmode: "driving", destination: stops[stops.length - 1].deliveryAddress });
  if (stops.length > 1) params.set("waypoints", stops.slice(0, -1).map((o) => o.deliveryAddress).join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
