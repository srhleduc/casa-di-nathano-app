// Autocomplétion d'adresse pour la livraison (/commande, mode « Me faire livrer »).
//
// Passe par le serveur plutôt que par le navigateur du client : pas de souci
// de CORS / de politique de sécurité, et si le service change d'adresse un
// jour, un seul fichier à modifier.
//
// Service utilisé : API de géocodage de la Géoplateforme (IGN), qui sert la
// Base Adresse Nationale. Gratuit, sans clé ni contrat. Elle remplace
// api-adresse.data.gouv.fr (arrêté fin janvier 2026).
//
// Ne renvoie que ce dont l'écran a besoin : libellé, code postal, ville et
// coordonnées GPS. Aucune donnée client n'est transmise au service (seule la
// recherche tapée est envoyée, jamais le nom ni le téléphone).

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "https://data.geopf.fr/geocodage/search/";

export async function GET(request) {
  const q = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 200);
  if (q.length < 3) return NextResponse.json({ results: [] });

  const url = new URL(ENDPOINT);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "6");
  url.searchParams.set("autocomplete", "1");

  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ results: [], error: "Service d'adresses indisponible" }, { status: 502 });
    }
    const json = await res.json();
    const results = (json.features || [])
      .map((f) => {
        const p = f.properties || {};
        const [lng, lat] = f.geometry?.coordinates || [];
        return { label: p.label, street: p.name, postcode: p.postcode, city: p.city, citycode: p.citycode || null, type: p.type, lat, lng };
      })
      // On écarte les résultats trop vagues (une commune ou un lieu-dit seul) :
      // il faut au moins une rue pour livrer.
      .filter(
        (r) =>
          r.label &&
          r.postcode &&
          Number.isFinite(r.lat) &&
          Number.isFinite(r.lng) &&
          r.type !== "municipality" &&
          r.type !== "locality"
      );
    return NextResponse.json({ results });
  } catch (err) {
    console.error("[adresse] recherche impossible:", err?.message || err);
    return NextResponse.json({ results: [], error: "Service d'adresses indisponible" }, { status: 502 });
  }
}
