// Route Handler du click & collect : seul chemin où une commande passe par le
// serveur, pour (1) capturer l'IP du client (indisponible côté navigateur) et
// (2) insérer atomiquement `orders` + `order_commitments` via la fonction
// Postgres create_takeaway_order.
//
// On ne stocke aucun secret service-role : le navigateur envoie son jeton de
// session Supabase (compte du restaurant) dans l'en-tête Authorization, on le
// rejoue vers Supabase pour que la RLS et my_restaurant_id() s'appliquent
// exactement comme lors d'un insert direct depuis le client.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ error: "Supabase non configuré côté serveur" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) {
    return NextResponse.json({ error: "Session absente" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const {
    items,
    serviceType,
    name,
    slotAllocations,
    pizzaCount,
    total,
    phone,
    commitmentAccepted,
    cgvSnapshot,
    cgvVersion,
  } = body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Panier vide" }, { status: 400 });
  }
  if (typeof phone !== "string" || phone.trim().length < 6) {
    return NextResponse.json({ error: "Numéro de téléphone requis" }, { status: 400 });
  }
  if (commitmentAccepted !== true) {
    return NextResponse.json({ error: "Engagement client non accepté" }, { status: 400 });
  }
  if (typeof cgvSnapshot !== "string" || cgvSnapshot.trim().length === 0) {
    return NextResponse.json({ error: "Texte CGV manquant" }, { status: 400 });
  }

  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0].trim() || request.headers.get("x-real-ip") || null;

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("create_takeaway_order", {
    p_items: items,
    p_service_type: serviceType,
    p_name: name || "Commande en ligne",
    p_slot_allocations: slotAllocations || [],
    p_pizza_count: pizzaCount || 0,
    p_total: total || 0,
    p_customer_phone: phone.trim(),
    p_cgv_text_snapshot: cgvSnapshot,
    p_cgv_version: cgvVersion || null,
    p_ip_address: ip,
  });

  if (error) {
    return NextResponse.json({ error: error.message || "Échec de l'enregistrement" }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    orderId: row?.order_id ?? null,
    takeawayNumber: row?.takeaway_number ?? null,
  });
}
