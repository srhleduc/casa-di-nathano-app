// Resynchronise le solde affiché sur la carte Google Wallet d'un client après
// un gain de points, ET envoie au plus une notification (nouveau solde, ou
// déblocage de bon si un palier de 150 vient d'être franchi).
//
//   POST /api/wallet/update-points
//   body : { customer_id?: uuid, phone?: string, solde: number, pointsAdded?: number }
//          (customer_id prioritaire ; sinon résolution par téléphone.
//           pointsAdded = points crédités par cet événement, sert à détecter
//           le franchissement de palier ; absent => aucune notification, juste
//           le PATCH silencieux.)
//
// Non bloquant par conception : renvoie toujours 200 (sauf corps inutilisable).
//   { patch: "ok"|"skipped"|"error", message: "ok"|"skipped"|"error"|"none" }
//   ("none" = aucune notification à envoyer pour cet événement)

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncWalletAfterPointsChange } from "@/lib/googleWallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const rawId = typeof body?.customer_id === "string" ? body.customer_id.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const soldeRaw = body?.solde;
  const solde = Number.isFinite(Number(soldeRaw)) ? Number(soldeRaw) : null;
  const pointsAdded = Number.isFinite(Number(body?.pointsAdded)) ? Number(body.pointsAdded) : 0;

  if (!rawId && !phone) {
    return NextResponse.json(
      { error: "customer_id ou phone requis" },
      { status: 400 }
    );
  }
  if (solde === null) {
    return NextResponse.json({ error: "solde requis" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ patch: "error", message: "none" });
  }
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let customerId = UUID_RE.test(rawId) ? rawId : null;
  let soldePoints = solde;

  if (!customerId && phone) {
    const { data, error } = await supabase.rpc("resolve_loyalty_wallet_by_phone", {
      p_phone: phone,
    });
    if (error) {
      console.error("[wallet] resolve_loyalty_wallet_by_phone:", error.message);
      return NextResponse.json({ patch: "error", message: "none" });
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      // Numéro invalide ou client inexistant : rien à synchroniser.
      return NextResponse.json({ patch: "skipped", message: "skipped" });
    }
    customerId = row.id;
    // Le solde envoyé par l'appelant fait foi ; on retombe sur celui de la
    // base s'il n'a pas été fourni proprement.
    if (!Number.isFinite(solde)) soldePoints = row.solde_points;
  }

  if (!customerId) {
    return NextResponse.json({ patch: "skipped", message: "skipped" });
  }

  const result = await syncWalletAfterPointsChange(customerId, soldePoints, pointsAdded);
  return NextResponse.json(result);
}
