// Tests des départs de livraison. Lancer : node lib/deliveryWaves.test.mjs
import { groupByTournee, buildWaveSchedule, computeWaveChoice, isWaveStillOffered, groupByWave, parseHHMM, formatHHMM, sectorLabel, buildRouteUrl, formatTimeInput, normalizeHHMM } from "./deliveryWaves.js";

let passed = 0;
let failed = 0;
function ok(cond, name) {
  if (cond) passed++;
  else {
    failed++;
    console.error("  ✗ " + name);
  }
}

// Grille par défaut : 18h30 → 21h00, toutes les 30 min, Est/Sud en alternance.
const grid = buildWaveSchedule();
ok(grid.length === 6, "6 départs de 18h30 à 21h00");
ok(grid.map((w) => w.departTime).join(",") === "18:30,19:00,19:30,20:00,20:30,21:00", "horaires attendus");
ok(grid.map((w) => w.sector).join(",") === "est,sud,est,sud,est,sud", "secteurs en alternance");
ok(grid.every((w) => w.capacity === 4 && w.active), "quota 4, actifs");
ok(buildWaveSchedule({ start: "x" }).length === 0, "heure invalide : aucune grille");
ok(buildWaveSchedule({ sectors: [] }).length === 0, "aucun secteur : aucune grille");
ok(buildWaveSchedule({ start: "19:00", end: "19:00" }).length === 1, "un seul départ si début = fin");
ok(parseHHMM("19:30") === 1170 && parseHHMM("19h30") === 1170, "parse HH:MM et HHhMM");
ok(parseHHMM("25:00") === null && parseHHMM("") === null, "heures invalides refusées");
ok(formatHHMM(1170) === "19:30", "format HH:MM");
ok(sectorLabel("est") === "Est" && sectorLabel(null) === "Local", "libellés de secteur");

// Créneaux four : toutes les 10 min de 18h00 à 21h30, capacité 6.
const slots = [];
for (let t = 18 * 60; t <= 21 * 60 + 30; t += 10) slots.push({ id: `s${t}`, label: formatHHMM(t), capacity: 6 });
const used = {}; // slotId -> pizzas déjà prises
const remainingFor = (s) => s.capacity - (used[s.id] || 0);
// Remplissage à rebours simplifié (même contrat que backwardFillPlanWithScheduled).
const fillPlan = (label, needed) => {
  const idx = slots.findIndex((s) => s.label === label);
  const plan = [];
  let left = needed;
  for (let i = idx; i >= 0 && left > 0; i--) {
    const r = remainingFor(slots[i]);
    if (r <= 0) continue;
    const take = Math.min(r, left);
    plan.push({ slotId: slots[i].id, label: slots[i].label, qty: take });
    left -= take;
  }
  if (left > 0) plan.push({ slotId: slots[idx].id, label: slots[idx].label, qty: left }); // débordement, comme business.js
  return plan.sort((a, b) => a.label.localeCompare(b.label));
};
const waves = [
  { departTime: "19:00", sector: "sud", remaining: 3 },
  { departTime: "18:30", sector: "est", remaining: 4 },
  { departTime: "19:30", sector: "est", remaining: 0 },
  { departTime: "20:00", sector: "sud", remaining: 2 },
];
const base = { waves, slots, remainingFor, fillPlan, marginMinutes: 7 };
const at = (h, m) => h * 60 + m;

let c = computeWaveChoice({ ...base, needed: 2, nowMinutes: at(18, 0) });
ok(c.mode === "waves", "mode waves");
ok(c.options.map((o) => o.time).join(",") === "18:30,19:00,20:00", "tri par heure, départ plein (quota 0) écarté");
ok(c.options[0].plan.length === 1 && c.options[0].plan[0].qty === 2 && c.options[0].plan[0].label === "18:30", "2 pizzas : un seul créneau four au départ");
ok(c.options[1].remaining === 3, "places de livraison restantes conservées");

// Marge de sécurité : à 18h25, le départ de 18h30 est trop proche (marge 7 min).
c = computeWaveChoice({ ...base, needed: 2, nowMinutes: at(18, 25) });
ok(c.options.map((o) => o.time).join(",") === "19:00,20:00", "départ trop proche écarté");
// Après l'heure du départ : plus proposé.
c = computeWaveChoice({ ...base, needed: 2, nowMinutes: at(19, 10) });
ok(c.options.map((o) => o.time).join(",") === "20:00", "départ passé écarté");

// Grosse commande : 9 pizzas, créneaux de 6 → réparti sur le créneau du départ et le précédent.
c = computeWaveChoice({ ...base, needed: 9, nowMinutes: at(18, 0) });
const nine = c.options.find((o) => o.time === "19:00");
ok(nine && nine.plan.length === 2 && nine.plan.reduce((s, p) => s + p.qty, 0) === 9, "9 pizzas réparties sur 2 créneaux four");
ok(nine.plan[nine.plan.length - 1].label === "19:00", "le dernier créneau est l'heure du départ");

// Four plein sur le créneau du départ ET les précédents : départ non proposé.
const fullSlots = { ...used };
for (const s of slots) used[s.id] = 6;
c = computeWaveChoice({ ...base, needed: 2, nowMinutes: at(18, 0) });
ok(c.options.length === 0, "four plein : aucun départ proposé");
for (const k of Object.keys(used)) delete used[k];
Object.assign(used, fullSlots);

// Débordement refusé : la capacité cumulée avant 18h30 ne suffit pas (le débordement
// dépasserait la capacité du créneau, la base refuserait).
for (const s of slots) used[s.id] = 5; // 1 place par créneau
c = computeWaveChoice({ ...base, needed: 400, nowMinutes: at(18, 0) });
ok(c.options.length === 0, "commande trop grosse pour le four : aucun départ");
for (const k of Object.keys(used)) delete used[k];

// Commande sans pizza (boissons/desserts) : seul le quota compte, plan vide.
c = computeWaveChoice({ ...base, needed: 0, nowMinutes: at(18, 0) });
ok(c.options.length === 3 && c.options.every((o) => o.plan.length === 0), "sans pizza : plan vide, quota seul");

// Départ sans créneau four correspondant : non proposé.
c = computeWaveChoice({ ...base, waves: [{ departTime: "22:00", sector: "est", remaining: 4 }], needed: 2, nowMinutes: at(18, 0) });
ok(c.options.length === 0, "pas de créneau four à l'heure du départ");

// Entrées absentes.
ok(computeWaveChoice({ ...base, waves: null, needed: 2, nowMinutes: 0 }).options.length === 0, "waves null");

// Choix toujours valable ?
c = computeWaveChoice({ ...base, needed: 2, nowMinutes: at(18, 0) });
ok(isWaveStillOffered(c, "19:00"), "départ encore proposé");
ok(!isWaveStillOffered(c, "19:30"), "départ plein non proposé");
ok(!isWaveStillOffered(null, "19:00"), "choix absent");

// Regroupement pour l'écran livreur.
const orders = [
  { id: "a", deliveryWave: "19:00", deliverySector: "sud" },
  { id: "b", deliveryWave: "18:30", deliverySector: "est" },
  { id: "c", deliveryWave: null, deliverySector: null },
  { id: "d", deliveryWave: "19:00", deliverySector: "sud" },
];
const groups = groupByWave(orders);
ok(groups.map((g) => g.time).join(",") === "18:30,19:00,", "groupes triés, « sans départ » en dernier");
ok(groups[1].orders.length === 2 && groups[1].sector === "sud", "2 commandes dans le départ de 19h00");
ok(groups[2].time === null, "groupe sans départ");
ok(groupByWave(null).length === 0, "liste absente");

// Itinéraire multi-arrêts.
ok(buildRouteUrl([]) === null && buildRouteUrl(null) === null, "aucune commande : pas de lien");
ok(buildRouteUrl([{ deliveryAddress: "" }]) === null, "adresse vide ignorée");
const one = new URL(buildRouteUrl([{ deliveryAddress: "1 rue A, Pont-Aven" }]));
ok(one.searchParams.get("destination") === "1 rue A, Pont-Aven" && !one.searchParams.has("waypoints"), "un arrêt : destination seule");
const route = new URL(
  buildRouteUrl([
    { deliveryAddress: "loin", deliveryDistanceKm: 9 },
    { deliveryAddress: "près", deliveryDistanceKm: 2 },
    { deliveryAddress: "milieu", deliveryDistanceKm: 5 },
  ])
);
ok(route.searchParams.get("destination") === "loin", "le plus éloigné est la destination");
ok(route.searchParams.get("waypoints") === "près|milieu", "étapes du plus proche au plus éloigné");
ok(route.searchParams.get("api") === "1", "paramètre api=1");
const ordered = new URL(buildRouteUrl([{ deliveryAddress: "z", deliveryDistanceKm: 9 }, { deliveryAddress: "a", deliveryDistanceKm: 1 }], { keepOrder: true }));
ok(ordered.searchParams.get("waypoints") === "z" && ordered.searchParams.get("destination") === "a", "keepOrder : pas de reclassement");
const many = Array.from({ length: 14 }, (_, i) => ({ deliveryAddress: `a${i}`, deliveryDistanceKm: i }));
ok(new URL(buildRouteUrl(many)).searchParams.get("waypoints").split("|").length === 9, "9 étapes au maximum (limite Google Maps)");

// Tournées = restaurant + départ.
const tour = groupByTournee([
  { id: "1", restaurantId: "riec", deliveryWave: "19:00", deliverySector: "sud" },
  { id: "2", restaurantId: "quimperle", deliveryWave: null },
  { id: "3", restaurantId: "riec", deliveryWave: "18:30", deliverySector: "est" },
  { id: "4", restaurantId: "riec", deliveryWave: "19:00", deliverySector: "sud" },
  { id: "5", restaurantId: "quimperle", deliveryWave: "19:00", deliverySector: "est" },
]);
ok(tour.length === 4, "4 tournées : deux restaurants ne se mélangent pas");
ok(tour.map((g) => `${g.restaurantId}:${g.time}`).join(",") === "riec:18:30,quimperle:19:00,riec:19:00,quimperle:null", "tournées triées par heure, sans départ en dernier");
ok(tour.find((g) => g.restaurantId === "riec" && g.time === "19:00").orders.length === 2, "2 commandes dans la tournée de Riec à 19h00");
ok(groupByTournee(null).length === 0, "liste absente");

// Saisie d'heure au clavier numérique (sans « : »).
ok(formatTimeInput("2") === "2" && formatTimeInput("23") === "23", "saisie : 1-2 chiffres inchangés");
ok(formatTimeInput("230") === "23:0" && formatTimeInput("2300") === "23:00", "saisie : « : » inséré après l'heure");
ok(formatTimeInput("930") === "9:30", "saisie : heure à un chiffre (>2)");
ok(formatTimeInput("23:00") === "23:00" && formatTimeInput("23:0") === "23:0", "saisie : valeur déjà formatée stable (retour arrière)");
ok(formatTimeInput("23005") === "23:00" && formatTimeInput("ab") === "", "saisie : 4 chiffres max, lettres ignorées");
ok(normalizeHHMM("23") === "23:00" && normalizeHHMM("9:30") === "09:30", "normalisation : heure seule / padding");
ok(normalizeHHMM("23h30") === "23:30" && normalizeHHMM("23.30") === "23:30" && normalizeHHMM("23,30") === "23:30", "normalisation : h . ,");
ok(normalizeHHMM("25") === "25" && normalizeHHMM("") === "", "normalisation : invalide renvoyé tel quel");

console.log(`deliveryWaves : ${passed} OK, ${failed} échec(s)`);
if (failed > 0) process.exit(1);
