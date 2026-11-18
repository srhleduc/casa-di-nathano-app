// Tests de la tournée du livreur. Lancer : node lib/tournee.test.mjs
import { haversineKm, estimateSeconds, estimateMatrix, hasCoords, bestOrder, planTournee, ordinalFr, buildDeliveryMessage, buildPreparationMessage, smsUrl } from "./tournee.js";

let passed = 0;
let failed = 0;
function ok(cond, name) {
  if (cond) passed++;
  else {
    failed++;
    console.error("  ✗ " + name);
  }
}

// Distances / estimations
const riec = { lat: 47.8508, lng: -3.6978 };
const moelan = { lat: 47.8215, lng: -3.6322 };
const km = haversineKm(riec, moelan);
ok(km > 4 && km < 8, `distance Riec → Moëlan plausible (${km.toFixed(1)} km)`);
ok(haversineKm(riec, riec) === 0, "distance nulle");
ok(estimateSeconds(riec, riec) === 0, "estimation nulle sur le même point");
ok(estimateSeconds(riec, { lat: riec.lat + 0.0001, lng: riec.lng }) === 60, "estimation : minimum 1 minute");
const m = estimateMatrix([riec, moelan]);
ok(m[0][0] === 0 && m[0][1] > 0 && m[0][1] === m[1][0], "matrice d'estimation symétrique");
ok(hasCoords(riec) && !hasCoords({ lat: NaN, lng: 1 }) && !hasCoords(null) && !hasCoords({ lat: 91, lng: 0 }), "coordonnées valides");

// Meilleur ordre : 0 = restaurant. A (1) est loin, B (2) près, C (3) au bout de B.
//   0→2 = 5, 2→3 = 5, 3→1 = 5  (total 15)   contre   0→1 = 20 …
const mat = [
  [0, 20, 5, 12],
  [20, 0, 14, 5],
  [5, 14, 0, 5],
  [12, 5, 5, 0],
];
ok(bestOrder(mat).join(",") === "2,3,1", "ordre optimal sur 3 arrêts");
ok(bestOrder([[0]]).length === 0 && bestOrder(null).length === 0, "aucun arrêt");
ok(bestOrder([[0, 3], [3, 0]]).join(",") === "1", "un seul arrêt");

// Au-delà de 8 arrêts : heuristique du plus proche, mais tous les arrêts sont visités une fois.
const big = Array.from({ length: 11 }, (_, i) => Array.from({ length: 11 }, (_, j) => (i === j ? 0 : Math.abs(i - j) * 60)));
const bigOrder = bestOrder(big);
ok(bigOrder.length === 10 && new Set(bigOrder).size === 10, "10 arrêts : chacun visité une fois");
ok(bigOrder.join(",") === "1,2,3,4,5,6,7,8,9,10", "10 arrêts alignés : parcours dans l'ordre");

// Plan de tournée complet, avec une matrice « service d'itinéraires » (en secondes).
const p0 = { id: "A", lat: 47.80, lng: -3.60 };
const p1 = { id: "B", lat: 47.84, lng: -3.68 };
const p2 = { id: "C", lat: 47.83, lng: -3.66 };
const durations = [
  [0, 1200, 300, 600],
  [1200, 0, 840, 300],
  [300, 840, 0, 300],
  [600, 300, 300, 0],
];
const plan = planTournee({ origin: riec, stops: [p0, p1, p2], durations });
ok(plan.order.join(",") === "B,C,A", "plan : ordre B, C, A");
ok(plan.source === "route", "plan : source = service d'itinéraires");
ok(plan.arrivals.B.position === 1 && plan.arrivals.B.minutes === 5, "B : 1re position, 5 min");
// C : 300 s (0→B) + 120 s remise + 300 s (B→C) = 720 s = 12 min
ok(plan.arrivals.C.position === 2 && plan.arrivals.C.minutes === 12, "C : 2e position, 12 min (remise comprise)");
// A : 720 + 120 + 300 (C→A) = 1140 s = 19 min
ok(plan.arrivals.A.position === 3 && plan.arrivals.A.minutes === 19, "A : 3e position, 19 min");
ok(plan.totalMinutes === 19, "durée totale = dernière arrivée");

// Matrice incomplète → estimation, signalée.
const holes = durations.map((r) => [...r]);
holes[0][1] = null;
const partial = planTournee({ origin: riec, stops: [p0, p1, p2], durations: holes });
ok(partial.source === "estimation", "case manquante : source = estimation");
ok(planTournee({ origin: riec, stops: [p0, p1, p2] }).source === "estimation", "pas de matrice : estimation");
ok(planTournee({ origin: riec, stops: [p0, p1, p2] }).order.length === 3, "estimation : tous les arrêts planifiés");

// Données absentes ou inutilisables.
ok(planTournee({ origin: null, stops: [p0] }) === null, "pas de restaurant : pas de plan");
ok(planTournee({ origin: riec, stops: [] }) === null, "pas d'arrêt : pas de plan");
const withBad = planTournee({ origin: riec, stops: [p0, { id: "X", lat: null, lng: null }] });
ok(withBad.order.join(",") === "A" && !withBad.arrivals.X, "arrêt sans coordonnées ignoré");

// Ordinaux et message.
ok(ordinalFr(1) === "1re" && ordinalFr(2) === "2e" && ordinalFr(4) === "4e", "ordinaux");
ok(
  buildDeliveryMessage({ restaurantName: "Casa Di Nathano", pizzaCount: 2, minutes: 12, position: 2 }) ===
    "Votre commande de pizzas est en route, le livreur en a pour environ 12 minutes et vous êtes en 2e position pour la livraison. Merci, La Casa Di Nathano.",
  "message complet (pizzas, 12 min, 2e position)"
);
ok(buildDeliveryMessage({ restaurantName: "Casa Di Luigi", pizzaCount: 1, minutes: 1, position: 1 }).startsWith("Votre commande de pizza est en route, le livreur en a pour environ 1 minute et vous êtes en 1re position"), "singulier : pizza, 1 minute, 1re");
ok(buildDeliveryMessage({ restaurantName: "La Casa", pizzaCount: 0, minutes: 5, position: 1 }).includes("Votre commande est en route") && buildDeliveryMessage({ restaurantName: "La Casa", pizzaCount: 0, minutes: 5, position: 1 }).endsWith("Merci, La Casa."), "sans pizza, « La » non doublé");
ok(buildDeliveryMessage({ restaurantName: "", pizzaCount: 1 }) === "Votre commande de pizza est en route, le livreur est en chemin. Merci.", "sans estimation ni signature");

// SMS.
const body = "Bonjour, ça va ?";
ok(smsUrl("+33 7 80 53 46 40", body, { platform: "android" }) === `sms:+33780534640?body=${encodeURIComponent(body)}`, "SMS Android : ?body=");
ok(smsUrl("+33780534640", body, { platform: "ios" }) === `sms:+33780534640&body=${encodeURIComponent(body)}`, "SMS iPhone : &body=");
ok(smsUrl("07.80.53.46.40", "") === "sms:0780534640", "SMS sans texte : conversation vide");
ok(smsUrl(null, null) === "sms:", "SMS sans numéro");

{
  const m = buildPreparationMessage({ restaurantName: "Casa Di Nathano", departTime: "19:30" });
  ok(m === "Votre commande est en cours de préparation, le départ de la livraison est prévu vers 19:30. Merci de votre patience, La Casa Di Nathano.", "message préparation avec départ");
  ok(buildPreparationMessage({ restaurantName: "Casa Di Nathano" }).includes("bientôt en route"), "message préparation sans départ");
}
console.log(`tournee : ${passed} OK, ${failed} échec(s)`);
if (failed > 0) process.exit(1);
