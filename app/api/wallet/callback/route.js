// Endpoint des callbacks Google Wallet (save / del).
// Google POST ici quand un client ajoute ou retire sa carte fidélité.
//
// 1. vérifie la signature ECv2SigningOnly (lib/googleWalletCallback) ;
// 2. déduplique par nonce et met à jour wallet_added_at via la fonction
//    Postgres apply_wallet_callback.
//
// Codes de retour :
//   400  signature invalide (Google ne doit pas rejouer un message falsifié)
//   500  signature OK mais traitement impossible (Google réessaiera)
//   200  traité, ou doublon, ou objet inconnu (Google arrête les retries)

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyGoogleWalletCallback } from "@/lib/googleWalletCallback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const raw = await request.text();

  let event;
  try {
    event = await verifyGoogleWalletCallback(raw);
  } catch (err) {
    console.warn("[wallet-callback] signature refusée:", err?.message || err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const { objectId, eventType, nonce } = event;
  console.log(`[wallet-callback] ${eventType} object=${objectId} nonce=${nonce}`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ error: "unavailable" }, { status: 500 });
  }
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("apply_wallet_callback", {
    p_object_id: objectId,
    p_event: eventType,
    p_nonce: nonce,
  });
  if (error) {
    console.error("[wallet-callback] apply_wallet_callback:", error.message);
    return NextResponse.json({ error: "unavailable" }, { status: 500 });
  }

  console.log(`[wallet-callback] ${nonce} -> ${data}`);
  return NextResponse.json({ status: data });
}

// Google peut sonder l'URL en GET/HEAD — répondre 200.
export async function GET() {
  return NextResponse.json({ ok: true });
}
