// Suivi de commande côté client : renvoie le statut d'UNE commande à partir de
// son jeton secret (UUID du lien reçu par email). Clé service_role côté serveur
// uniquement ; on ne renvoie que le strict nécessaire (pas de téléphone, pas
// d'email, pas d'IP).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return NextResponse.json({ error: "Suivi indisponible." }, { status: 501 });

  const token = new URL(request.url).searchParams.get("t") || "";
  if (!UUID_RE.test(token)) return NextResponse.json({ error: "Lien invalide." }, { status: 400 });

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: o } = await admin
    .from("orders")
    .select("restaurant_id, takeaway_number, status, delivery_status, items, total, delivery_address, slot_allocations, scheduled_time, is_test")
    .eq("tracking_token", token)
    .maybeSingle();
  if (!o) return NextResponse.json({ error: "Commande introuvable (terminée ou annulée)." }, { status: 404 });

  const { data: r } = await admin.from("restaurants").select("name, phone").eq("id", o.restaurant_id).maybeSingle();
  return NextResponse.json(
    {
      restaurantName: r?.name || "",
      restaurantPhone: r?.phone || "",
      number: o.takeaway_number,
      status: o.status,
      deliveryStatus: o.delivery_status || null,
      deliveryAddress: o.delivery_status ? o.delivery_address : null,
      total: o.total,
      isTest: Boolean(o.is_test),
      slot: Array.isArray(o.slot_allocations) && o.slot_allocations.length ? o.slot_allocations : null,
      scheduledTime: o.scheduled_time || null,
      items: (Array.isArray(o.items) ? o.items : []).map((it) => ({ name: it.name || it.label || "Article", qty: it.qty ?? 1 })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
