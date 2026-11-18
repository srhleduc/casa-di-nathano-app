// Aperçu du bon de réduction rattaché à un numéro (écran de commande client).
//
//   POST /api/bon   body : { phone: string }
//   -> { voucher: { amount, expiresAt } | null }
//
// Même mécanique d'auth que /api/commande : on rejoue le jeton de session du
// restaurant vers Supabase. La fonction Postgres find_phone_voucher ne renvoie
// que le montant et l'échéance (jamais le motif interne) et rate-limite par IP
// (table loyalty_public_lookups, partagée avec /api/mon-compte). Ce n'est
// qu'un affichage : la déduction réelle est faite par create_*_order.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  return null;
}

export async function POST(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ voucher: null });

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return NextResponse.json({ error: "Session absente" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ voucher: null });
  }
  const phone = typeof body?.phone === "string" ? body.phone.trim().slice(0, 30) : "";
  if (phone.length < 6) return NextResponse.json({ voucher: null });

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("find_phone_voucher", { p_phone: phone, p_ip: clientIp(request) });
  if (error) return NextResponse.json({ voucher: null });

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.voucher_code) return NextResponse.json({ voucher: null });
  return NextResponse.json({
    voucher: { amount: Number(row.voucher_reduction), expiresAt: row.voucher_expires_at },
  });
}
