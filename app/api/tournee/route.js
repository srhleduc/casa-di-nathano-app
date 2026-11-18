// Durées de trajet entre le restaurant et les livraisons d'une tournée, pour
// l'appli livreur (ordre des arrêts, temps annoncés aux clients).
//
// Appelle le service d'itinéraires OpenStreetMap (OSRM, profil voiture, gratuit,
// sans clé) côté serveur : un navigateur ne peut pas y fixer l'en-tête
// User-Agent exigé par le service, et la route est réservée aux livreurs pour ne
// pas servir de relais ouvert. Adresse du service modifiable avec la variable
// d'environnement ROUTING_BASE_URL (ex. un hébergeur OSRM payant) sans toucher au code.
//
// Politique d'usage du service public (FOSSGIS) : 1 requête par seconde au
// maximum, pas d'usage intensif, User-Agent valide, aucune garantie de
// disponibilité. D'où le repli côté appli : si cette route échoue, la tournée
// est calculée avec une estimation à vol d'oiseau, signalée comme telle.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_BASE_URL = "https://routing.openstreetmap.de/routed-car";
const USER_AGENT = "casa-di-nathano-app/1.0 (livraisons; tournee)";
const MAX_POINTS = 11; // le restaurant + 10 livraisons
const TIMEOUT_MS = 7000;

export async function POST(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ error: "Supabase non configuré côté serveur" }, { status: 500 });

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return NextResponse.json({ error: "Session absente" }, { status: 401 });

  // Réservé aux livreurs (même contrôle que la RLS : fonction is_driver()).
  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: isDriver, error: authError } = await supabase.rpc("is_driver");
  if (authError || isDriver !== true) return NextResponse.json({ error: "Accès livreur requis" }, { status: 403 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }
  const points = body?.points;
  const valid =
    Array.isArray(points) &&
    points.length >= 2 &&
    points.length <= MAX_POINTS &&
    points.every((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180);
  if (!valid) return NextResponse.json({ error: "Points invalides" }, { status: 400 });

  const base = (process.env.ROUTING_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/table/v1/driving/${coords}?annotations=duration`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.code !== "Ok" || !Array.isArray(json.durations)) {
      return NextResponse.json({ error: "Service d'itinéraires indisponible" }, { status: 502 });
    }
    return NextResponse.json({ durations: json.durations });
  } catch (err) {
    console.error("[tournee] service d'itinéraires :", err?.message || err);
    return NextResponse.json({ error: "Service d'itinéraires indisponible" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
