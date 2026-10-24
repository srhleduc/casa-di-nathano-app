// Route Handler du journal des saisies du code équipe (voir
// supabase/migrations_manual/team_pin_log.sql).
//
// Le navigateur signale chaque saisie complète du code (réussie ou ratée) ; ici
// on ajoute ce que seul le serveur connaît — l'IP et la ville estimée par Vercel
// (en-têtes x-vercel-ip-*) — puis on appelle la fonction Postgres avec le jeton
// de session du compte équipe, comme /api/commande : aucun secret service-role.
//
// Jamais bloquant : si l'enregistrement échoue, on répond quand même 204 pour ne
// pas gêner l'équipe en plein service. Le code saisi n'est pas transmis.
//
// La ville vient d'une géolocalisation par IP : approximative, surtout sur
// mobile (un opérateur peut router par une autre ville).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vercel encode les valeurs non ASCII des en-têtes de géolocalisation (« Quimperl%C3%A9 »).
function readGeoHeader(request, name) {
  const raw = request.headers.get(name);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw).slice(0, 120) || null;
  } catch {
    return raw.slice(0, 120) || null;
  }
}

export async function POST(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;
  if (!url || !anon || !token) return new NextResponse(null, { status: 204 });

  let success = false;
  try {
    const body = await request.json();
    success = body?.success === true;
  } catch {
    // corps invalide : on journalise comme un échec
  }

  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0].trim() || request.headers.get("x-real-ip") || null;
  const userAgent = (request.headers.get("user-agent") || "").slice(0, 500) || null;

  try {
    const supabase = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await supabase.rpc("log_team_pin_attempt", {
      p_success: success,
      p_ip: ip,
      p_city: readGeoHeader(request, "x-vercel-ip-city"),
      p_region: readGeoHeader(request, "x-vercel-ip-country-region"),
      p_country: readGeoHeader(request, "x-vercel-ip-country"),
      p_user_agent: userAgent,
    });
    if (error) console.error("[team-access] journal:", error.message);
  } catch (err) {
    console.error("[team-access] journal:", err?.message || err);
  }

  return new NextResponse(null, { status: 204 });
}
