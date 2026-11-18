// Tournée du livreur : ordre des arrêts, temps estimés, message aux clients.
// Logique pure, sans dépendance, testée par lib/tournee.test.mjs.
//
// Principe : on dispose d'une matrice de durées (secondes) entre le restaurant
// (index 0) et chaque livraison (index 1…n). Elle vient d'un service
// d'itinéraires (route /api/tournee) ; si le service ne répond pas, on la
// remplace par une estimation à vol d'oiseau (`estimateMatrix`), signalée
// comme telle (`source: "estimation"`). L'ordre retenu est celui qui minimise
// le temps de route total jusqu'à la dernière livraison (sans le retour).

const EARTH_RADIUS_KM = 6371;
// Estimation de repli : trajet à vol d'oiseau × 1,35 (routes sinueuses) à 40 km/h
// de moyenne (petites routes et villages).
const DETOUR_FACTOR = 1.35;
const AVERAGE_KMH = 40;
// Temps passé à chaque livraison (garer, sonner, remettre la commande).
export const DEFAULT_HANDOVER_SECONDS = 120;
// Au-delà, on ne teste plus tous les ordres possibles (8 arrêts = 40 320 ordres).
const EXACT_SEARCH_MAX_STOPS = 8;

export function haversineKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function estimateSeconds(a, b) {
  if (a === b) return 0;
  return Math.max(60, Math.round(((haversineKm(a, b) * DETOUR_FACTOR) / AVERAGE_KMH) * 3600));
}

export function estimateMatrix(points) {
  return points.map((a, i) => points.map((b, j) => (i === j ? 0 : estimateSeconds(a, b))));
}

// Coordonnées utilisables ?
export function hasCoords(p) {
  return Boolean(p) && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}

// Ordre des arrêts (indices 1…n de la matrice) qui minimise le temps de route
// total, en partant de l'index 0 et sans retour.
export function bestOrder(matrix) {
  const n = (matrix?.length || 0) - 1;
  if (n <= 0) return [];
  if (n === 1) return [1];

  if (n <= EXACT_SEARCH_MAX_STOPS) {
    let best = null;
    let bestCost = Infinity;
    const used = new Array(n + 1).fill(false);
    const path = [];
    const walk = (from, cost) => {
      if (cost >= bestCost) return; // inutile de poursuivre : déjà plus long
      if (path.length === n) {
        bestCost = cost;
        best = [...path];
        return;
      }
      for (let k = 1; k <= n; k++) {
        if (used[k]) continue;
        used[k] = true;
        path.push(k);
        walk(k, cost + matrix[from][k]);
        path.pop();
        used[k] = false;
      }
    };
    walk(0, 0);
    return best;
  }

  // Beaucoup d'arrêts : on va toujours au plus proche (approximation).
  const order = [];
  const left = new Set(Array.from({ length: n }, (_, i) => i + 1));
  let from = 0;
  while (left.size) {
    let next = null;
    for (const k of left) if (next === null || matrix[from][k] < matrix[from][next]) next = k;
    order.push(next);
    left.delete(next);
    from = next;
  }
  return order;
}

// Plan complet d'une tournée.
//   origin    : { lat, lng } du restaurant
//   stops     : [{ id, lat, lng }, …] (livraisons prêtes)
//   durations : matrice (secondes) de service d'itinéraires, ou null
// Renvoie { order: [id…], arrivals: { id: { position, minutes } }, totalMinutes, source }
// où `minutes` = temps avant d'arriver chez ce client (trajets + remises précédentes).
export function planTournee({ origin, stops, durations = null, handoverSeconds = DEFAULT_HANDOVER_SECONDS }) {
  const valid = (stops || []).filter(hasCoords);
  if (!hasCoords(origin) || valid.length === 0) return null;

  const points = [origin, ...valid];
  const fallback = estimateMatrix(points);
  let source = "route";
  const matrix = points.map((_, i) =>
    points.map((_, j) => {
      if (i === j) return 0;
      const v = durations?.[i]?.[j];
      if (Number.isFinite(v) && v >= 0) return v;
      source = "estimation";
      return fallback[i][j];
    })
  );

  const order = bestOrder(matrix);
  const arrivals = {};
  let elapsed = 0;
  let from = 0;
  order.forEach((idx, k) => {
    elapsed += matrix[from][idx] + (k > 0 ? handoverSeconds : 0);
    arrivals[valid[idx - 1].id] = { position: k + 1, minutes: Math.max(1, Math.ceil(elapsed / 60)) };
    from = idx;
  });
  return {
    order: order.map((idx) => valid[idx - 1].id),
    arrivals,
    totalMinutes: Math.max(1, Math.ceil(elapsed / 60)),
    source,
  };
}

export function ordinalFr(n) {
  return n === 1 ? "1re" : `${n}e`;
}

// Message prêt à envoyer au client (SMS).
export function buildDeliveryMessage({ restaurantName, pizzaCount = 0, minutes, position }) {
  const sign = (restaurantName || "").trim();
  const signature = sign ? (/^la\s/i.test(sign) ? sign : `La ${sign}`) : "";
  const what = pizzaCount > 1 ? "Votre commande de pizzas" : pizzaCount === 1 ? "Votre commande de pizza" : "Votre commande";
  const eta = minutes ? `le livreur en a pour environ ${minutes} minute${minutes > 1 ? "s" : ""}` : "le livreur est en chemin";
  const pos = position ? ` et vous êtes en ${ordinalFr(position)} position pour la livraison` : "";
  return `${what} est en route, ${eta}${pos}. Merci${signature ? `, ${signature}` : ""}.`;
}

// Message pour une commande encore en cuisine (prévenir d'un délai, par exemple).
export function buildPreparationMessage({ restaurantName, departTime }) {
  const sign = (restaurantName || "").trim();
  const signature = sign ? (/^la\s/i.test(sign) ? sign : `La ${sign}`) : "";
  const when = departTime ? `le départ de la livraison est prévu vers ${departTime}` : "elle sera bientôt en route";
  return `Votre commande est en cours de préparation, ${when}. Merci de votre patience${signature ? `, ${signature}` : ""}.`;
}

// Lien « envoyer un SMS » : le téléphone ouvre sa messagerie avec le texte déjà
// écrit, le livreur n'a plus qu'à envoyer. Android attend `?body=`, iPhone `&body=`.
export function smsUrl(phone, body, { platform = "other" } = {}) {
  const number = String(phone || "").replace(/[\s.\-()]/g, "");
  if (!body) return `sms:${number}`;
  return `sms:${number}${platform === "ios" ? "&" : "?"}body=${encodeURIComponent(body)}`;
}
