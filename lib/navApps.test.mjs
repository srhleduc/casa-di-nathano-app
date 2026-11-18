// Tests du choix de l'application GPS. Lancer : node lib/navApps.test.mjs
import { NAV_APPS, navUrl, routeLink, isValidNavApp, detectPlatform } from "./navApps.js";

let passed = 0;
let failed = 0;
function ok(cond, name) {
  if (cond) passed++;
  else {
    failed++;
    console.error("  ✗ " + name);
  }
}

const addr = "Impasse de la Petite Lande 29350 Moëlan-sur-Mer";
const q = encodeURIComponent(addr);

ok(NAV_APPS.length === 4, "4 choix proposés");
ok(isValidNavApp("waze") && !isValidNavApp("bing") && !isValidNavApp(null), "validation de la clé");
ok(navUrl("google", addr).startsWith("https://www.google.com/maps/dir/") && navUrl("google", addr).includes(q), "Google Maps");
ok(navUrl("waze", addr) === `https://waze.com/ul?q=${q}&navigate=yes`, "Waze");
ok(navUrl("apple", addr).startsWith("https://maps.apple.com/?daddr=") && navUrl("apple", addr).includes(q), "Plans (Apple)");
ok(navUrl("system", addr, { platform: "android" }) === `geo:0,0?q=${q}`, "choix du téléphone sur Android : lien geo:");
ok(navUrl("system", addr, { platform: "ios" }).startsWith("https://maps.apple.com/"), "choix du téléphone sur iPhone : Plans");
ok(navUrl("system", addr).startsWith("https://www.google.com/maps/"), "choix du téléphone ailleurs : Google Maps");
ok(navUrl("inconnue", addr).startsWith("https://www.google.com/maps/"), "clé inconnue : Google Maps");
ok(navUrl("waze", "").includes("q=&"), "adresse vide sans plantage");

const orders = [
  { deliveryAddress: "loin", deliveryDistanceKm: 9 },
  { deliveryAddress: "près", deliveryDistanceKm: 2 },
];
const g = routeLink("google", orders);
ok(g.multi && g.url.includes("waypoints") && g.label === "Tournée complète (2 arrêts)", "Google : tournée multi-arrêts");
ok(routeLink(undefined, orders).multi, "préférence absente : Google Maps");
const w = routeLink("waze", orders);
ok(!w.multi && w.url.includes(encodeURIComponent("près")) && w.label.startsWith("Premier arrêt"), "Waze : premier arrêt (le plus proche)");
const one = routeLink("waze", [{ deliveryAddress: "seul" }]);
ok(one.label === "Itinéraire", "un seul arrêt : « Itinéraire »");
ok(routeLink("waze", []) === null && routeLink("google", null) === null, "aucune commande : pas de lien");
ok(routeLink("google", [{ deliveryAddress: "" }]) === null, "adresse vide ignorée");

ok(detectPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8)") === "android", "détection Android");
ok(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)") === "ios", "détection iPhone");
ok(detectPlatform("Mozilla/5.0 (Windows NT 10.0)") === "other" && detectPlatform(null) === "other", "autres appareils");

console.log(`navApps : ${passed} OK, ${failed} échec(s)`);
if (failed > 0) process.exit(1);
