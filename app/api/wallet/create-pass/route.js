// Génère le lien "Ajouter à Google Wallet" pour un client fidélité réel.
//
//   GET /api/wallet/create-pass?customer_id=<uuid>
//   -> { saveUrl }
//
// Lit nom + solde via la fonction Postgres security definer
// get_loyalty_wallet_customer (la route n'a pas de session : appel anon).
// Marque wallet_added_at de façon optimiste dès qu'un lien est produit ; le
// webhook Google confirmera/écrasera plus tard.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildSaveUrl } from "@/lib/googleWallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const customerId = (searchParams.get("customer_id") || "").trim();
  if (!UUID_RE.test(customerId)) {
    return NextResponse.json({ error: "customer_id invalide" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("get_loyalty_wallet_customer", {
    p_id: customerId,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const customer = Array.isArray(data) ? data[0] : data;
  if (!customer) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }

  let saveUrl;
  try {
    saveUrl = buildSaveUrl({
      customerId,
      nom: customer.nom,
      soldePoints: customer.solde_points,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Échec de génération du pass" },
      { status: 500 }
    );
  }

  // Optimiste : n'écrase pas un horodatage déjà posé (fonction idempotente).
  // Awaité pour être sûr que l'écriture parte avant la fin de la fonction
  // serverless, mais une erreur ici ne doit pas priver le client de son lien.
  const { error: markErr } = await supabase.rpc("mark_loyalty_wallet_added", {
    p_id: customerId,
  });
  if (markErr) {
    console.error("[wallet] mark_loyalty_wallet_added:", markErr.message);
  }

  return NextResponse.json({ saveUrl });
}
