// Application GPS préférée du livreur — logique pure, testée par
// lib/navApps.test.mjs. Le choix est mémorisé sur l'appareil (localStorage),
// pas sur le compte : un livreur peut avoir une préférence différente sur
// chaque téléphone.
//
// Seul Google Maps sait ouvrir une tournée avec plusieurs arrêts depuis un
// lien. Avec les autres applications, le bouton « tournée » devient « premier
// arrêt » (le plus proche du restaurant) et le livreur enchaîne arrêt par arrêt.

import { buildRouteUrl } from "./deliveryWaves.js";

export const NAV_APPS = [
  { key: "google", label: "Google Maps" },
  { key: "waze", label: "Waze" },
  { key: "apple", label: "Plans (Apple)" },
  { key: "system", label: "Choisir à chaque fois" },
];

export const DEFAULT_NAV_APP = "google";
export const NAV_APP_STORAGE_KEY = "casa_nav_app";

export function isValidNavApp(key) {
  return NAV_APPS.some((a) => a.key === key);
}

// `platform` : "ios" | "android" | autre — sert uniquement à « Choisir à chaque
// fois » : sur Android, un lien geo: ouvre le sélecteur d'applications du
// téléphone ; sur iPhone ce mécanisme n'existe pas, on ouvre Plans.
export function navUrl(app, address, { platform = "other" } = {}) {
  const q = encodeURIComponent(address || "");
  switch (app) {
    case "waze":
      return `https://waze.com/ul?q=${q}&navigate=yes`;
    case "apple":
      return `https://maps.apple.com/?daddr=${q}&dirflg=d`;
    case "system":
      if (platform === "android") return `geo:0,0?q=${q}`;
      if (platform === "ios") return `https://maps.apple.com/?daddr=${q}&dirflg=d`;
      return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  }
}

// Lien du bouton « tournée » d'un départ : { url, label, multi }. Google Maps :
// tous les arrêts d'un coup. Autres applications : seulement le premier arrêt.
// `keepOrder` : les commandes sont déjà classées dans l'ordre de la tournée calculée.
export function routeLink(app, orders, { platform = "other", keepOrder = false } = {}) {
  const stops = (orders || []).filter((o) => o && o.deliveryAddress);
  if (stops.length === 0) return null;
  if ((app || DEFAULT_NAV_APP) === "google") {
    return { url: buildRouteUrl(stops, { keepOrder }), label: `Tournée complète${stops.length > 1 ? ` (${Math.min(stops.length, 10)} arrêts)` : ""}`, multi: true };
  }
  const first = keepOrder ? stops[0] : [...stops].sort((a, b) => (a.deliveryDistanceKm ?? 1e9) - (b.deliveryDistanceKm ?? 1e9))[0];
  return { url: navUrl(app, first.deliveryAddress, { platform }), label: stops.length > 1 ? "Premier arrêt (le plus proche)" : "Itinéraire", multi: false };
}

export function detectPlatform(userAgent) {
  const ua = String(userAgent || "");
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "other";
}
