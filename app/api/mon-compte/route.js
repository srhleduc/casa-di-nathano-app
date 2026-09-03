// Backend de la page client publique /mon-compte.
//
//   POST /api/mon-compte
//   body : { phone: string, lastName: string }
//
// Vérification légère (téléphone + nom de famille), pas de vraie auth :
// l'enjeu est bas (des points de fidélité). Tout passe par la fonction
// Postgres security definer resolve_loyalty_customer_public, qui :
//   - rate-limite par IP (anti-brute-force) ;
//   - renvoie le MÊME status 'not_found' pour "numéro inconnu" et "nom
//     incorrect" (pas d'oracle d'énumération).
//
// Si trouvé : on réutilise la logique de /api/wallet/create-pass
// (buildSaveUrl + mark_loyalty_wallet_added) pour renvoyer directement le
// lien "Ajouter à Google Wallet". Aucun customer_id n'est exposé au
// navigateur, aucune donnée au-delà du solde de points.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildSaveUrl } from "@/lib/googleWallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Réponse générique : ni "numéro inconnu" ni "nom incorrect", juste "pas de
// correspondance". Sert aussi pour les entrées vides / mal formées.
const NOT_FOUND = { found: false };

// IP de l'appelant pour le rate limit. Sur Vercel, x-real-ip = IP client
// unique, x-forwarded-for = chaîne (client en tête). On renvoie "unknown" si
// rien d'exploitable — le rate limit par IP est alors désactivé côté base
// (cf. resolve_loyalty_customer_public) pour ne pas bucketiser tous les
// clients ensemble.
function clientIp(request) {
  const candidates = [
    request.headers.get("x-real-ip"),
    (request.headers.get("x-forwarded-for") || "").split(",")[0],
    (request.headers.get("x-vercel-forwarded-for") || "").split(",")[0],
  ];
  for (const c of candidates) {
    const v = (c || "").trim();
    if (v) return v;
  }
  return "unknown";
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const lastName =
    typeof body?.lastName === "string"
      ? body.lastName.trim()
      : typeof body?.nom === "string"
      ? body.nom.trim()
      : "";

  // Bornes larges : le vrai contrôle (format, existence) est fait en base.
  // Entrées manifestement vides -> même réponse que "pas trouvé".
  if (phone.length < 6 || phone.length > 24 || lastName.length < 2 || lastName.length > 80) {
    return NextResponse.json(NOT_FOUND);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ error: "Service indisponible" }, { status: 500 });
  }

  const ip = clientIp(request);
  console.log(`[mon-compte] lookup ip=${ip}`);

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("resolve_loyalty_customer_public", {
    p_phone: phone,
    p_nom: lastName,
    p_ip: ip,
  });
  if (error) {
    console.error("[mon-compte] resolve_loyalty_customer_public:", error.message);
    return NextResponse.json({ error: "Service indisponible" }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (row?.status === "rate_limited") {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  if (!row || row.status !== "ok" || !row.id) {
    return NextResponse.json(NOT_FOUND);
  }

  let saveUrl;
  try {
    saveUrl = buildSaveUrl({
      customerId: row.id,
      nom: row.nom,
      soldePoints: row.solde_points,
    });
  } catch (err) {
    console.error("[mon-compte] buildSaveUrl:", err?.message || err);
    return NextResponse.json({ error: "Service indisponible" }, { status: 500 });
  }

  // Optimiste, comme /api/wallet/create-pass : le client vient de générer son
  // lien. Non bloquant.
  const { error: markErr } = await supabase.rpc("mark_loyalty_wallet_added", { p_id: row.id });
  if (markErr) console.error("[mon-compte] mark_loyalty_wallet_added:", markErr.message);

  return NextResponse.json({
    found: true,
    soldePoints: row.solde_points,
    saveUrl,
  });
}
