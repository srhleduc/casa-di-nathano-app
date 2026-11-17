// Liste des communes situées dans un rayon autour du restaurant — alimente
// la section « Villes desservies » de l'espace Direction (Livraison → selon la
// distance).
//
// Source : API Découpage administratif (API Géo, geo.api.gouv.fr), gratuite et
// sans clé. Elle ne sait pas chercher « dans un rayon », donc on procède en
// deux temps :
//   1. on repère les départements touchés par le cercle (le centre + deux
//      anneaux de points autour du restaurant) ;
//   2. on récupère les communes de ces départements et on garde celles dont le
//      centre est à moins de `radius` km (distance à vol d'oiseau).
// Une commune est comptée selon la position de son centre ; les réglages par
// ville servent justement à corriger les grandes communes.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = "https://geo.api.gouv.fr";
const EARTH_KM = 6371;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

function distanceKm(lat1, lon1, lat2, lon2) {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
}

// Point situé à `km` kilomètres de (lat, lon) dans la direction `bearing` (degrés).
function destination(lat, lon, bearing, km) {
  const d = km / EARTH_KM;
  const b = rad(bearing);
  const la1 = rad(lat);
  const lo1 = rad(lon);
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
  const lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return [deg(la2), deg(lo2)];
}

export async function GET(request) {
  const sp = new URL(request.url).searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const radius = Math.min(Math.max(Number(sp.get("radius")), 1), 40); // 1 à 40 km
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius)) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }

  try {
    // 1. Départements touchés par le cercle.
    const points = [[lat, lng]];
    for (const ring of [radius, radius / 2]) {
      for (let bearing = 0; bearing < 360; bearing += 45) points.push(destination(lat, lng, bearing, ring));
    }
    const departements = new Set();
    await Promise.all(
      points.map(async ([la, lo]) => {
        try {
          const res = await fetch(`${API}/communes?lat=${la}&lon=${lo}&fields=codeDepartement&format=json`, {
            signal: AbortSignal.timeout(6000),
            cache: "no-store",
          });
          if (!res.ok) return;
          const arr = await res.json();
          const code = arr?.[0]?.codeDepartement;
          if (code) departements.add(code);
        } catch {
          // un point en mer ou une réponse perdue ne doit pas tout bloquer
        }
      })
    );
    if (departements.size === 0) {
      return NextResponse.json({ error: "Service des communes indisponible" }, { status: 502 });
    }

    // 2. Communes de ces départements, filtrées par distance.
    const lists = await Promise.all(
      [...departements].map(async (code) => {
        const res = await fetch(`${API}/communes?codeDepartement=${encodeURIComponent(code)}&fields=nom,code,codesPostaux,centre&format=json&geometry=centre`, {
          signal: AbortSignal.timeout(10000),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`communes ${code}: ${res.status}`);
        return res.json();
      })
    );
    const communes = lists
      .flat()
      .map((c) => {
        const [lo, la] = c.centre?.coordinates || [];
        if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
        return { code: c.code, nom: c.nom, codesPostaux: c.codesPostaux || [], distanceKm: Math.round(distanceKm(lat, lng, la, lo) * 10) / 10 };
      })
      .filter((c) => c && c.distanceKm <= radius)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return NextResponse.json({ communes });
  } catch (err) {
    console.error("[communes] liste impossible:", err?.message || err);
    return NextResponse.json({ error: "Service des communes indisponible" }, { status: 502 });
  }
}
