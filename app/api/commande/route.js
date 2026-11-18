// Route Handler du click & collect : seul chemin où une commande passe par le
// serveur, pour (1) capturer l'IP et le user-agent du client (indisponibles
// ou non fiables côté navigateur) et (2) insérer atomiquement `orders` +
// `order_commitments` via la fonction Postgres create_takeaway_order.
//
// L'IP et le user-agent sont des données techniques standards envoyées par
// tout navigateur à chaque requête HTTP — pas de fingerprinting avancé, pas
// de cookie de suivi. Objectif : garder une trace exploitable en cas de
// no-show (numéro bidon, commande fantôme), documenté dans les CGV
// (lib/cgv.js, section 7).
//
// On ne stocke aucun secret service-role : le navigateur envoie son jeton de
// session Supabase (compte du restaurant) dans l'en-tête Authorization, on le
// rejoue vers Supabase pour que la RLS et my_restaurant_id() s'appliquent
// exactement comme lors d'un insert direct depuis le client.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncWalletAfterPointsChange } from "@/lib/googleWallet";
import { EMAIL_RE } from "@/lib/orderTracking";
import { sendOrderConfirmationEmail } from "@/lib/orderEmail";

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
    delivery,
    email,
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
  // Header standard envoyé par tout navigateur/app ; tronqué par sécurité
  // (certains clients envoient des UA anormalement longs).
  const userAgent = (request.headers.get("user-agent") || "").slice(0, 500) || null;

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Livraison : même parcours, mais via create_delivery_order, qui revalide
  // côté base l'éligibilité de l'adresse, le minimum de commande et les frais
  // (le client ne fixe jamais le prix de la livraison). Un rejet métier
  // (hors zone, minimum non atteint) revient en 400 avec le message à afficher.
  let rpcName = "create_takeaway_order";
  let rpcArgs = {
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
    p_user_agent: userAgent,
  };
  if (delivery) {
    if (typeof delivery.address !== "string" || delivery.address.trim().length < 3) {
      return NextResponse.json({ error: "Adresse de livraison requise" }, { status: 400 });
    }
    rpcName = "create_delivery_order";
    rpcArgs = {
      p_items: items,
      p_service_type: serviceType,
      p_name: name || "Commande en ligne",
      p_slot_allocations: slotAllocations || [],
      p_pizza_count: pizzaCount || 0,
      p_subtotal: total || 0,
      p_customer_phone: phone.trim(),
      p_delivery_address: delivery.address,
      p_delivery_postal_code: delivery.postalCode || null,
      p_delivery_city: delivery.city || null,
      p_delivery_lat: Number.isFinite(delivery.lat) ? delivery.lat : null,
      p_delivery_lng: Number.isFinite(delivery.lng) ? delivery.lng : null,
      p_delivery_instructions: delivery.instructions || null,
      p_cgv_text_snapshot: cgvSnapshot,
      p_cgv_version: cgvVersion || null,
      p_ip_address: ip,
      p_user_agent: userAgent,
      p_delivery_citycode: delivery.cityCode || null,
    };
  }

  const { data, error } = await supabase.rpc(rpcName, rpcArgs);

  if (error) {
    const businessRejection = delivery && /hors de notre zone|Minimum de commande|indisponible|Adresse/i.test(error.message || "");
    return NextResponse.json(
      { error: error.message || "Échec de l'enregistrement" },
      { status: businessRejection ? 400 : 500 }
    );
  }

  const row = Array.isArray(data) ? data[0] : data;

  // Fidélité Google Wallet : create_takeaway_order a déjà crédité les points
  // (award_loyalty_points, dans la même transaction). On resynchronise le solde
  // affiché sur la carte du client s'il en a ajouté une, et on envoie au plus
  // une notification (nouveau solde, ou déblocage de bon). Jamais bloquant pour
  // la confirmation de commande.
  try {
    const { data: walletRows } = await supabase.rpc(
      "resolve_loyalty_wallet_by_phone",
      { p_phone: phone.trim() }
    );
    const walletRow = Array.isArray(walletRows) ? walletRows[0] : walletRows;
    if (walletRow?.id) {
      // Points crédités = floor(total), comme award_loyalty_points.
      await syncWalletAfterPointsChange(
        walletRow.id,
        walletRow.solde_points,
        Math.floor(Number(total) || 0)
      );
    }
  } catch (err) {
    console.error("[wallet] sync click&collect:", err?.message || err);
  }

  // Suivi par email (facultatif, jamais bloquant). Besoin de la clé service_role
  // (SUPABASE_SERVICE_ROLE_KEY) pour lire le jeton de suivi et enregistrer l'email.
  let trackingUrl = null;
  let emailSent = false;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (row?.order_id && service) {
    try {
      const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
      const cleanEmail = typeof email === "string" ? email.trim().toLowerCase().slice(0, 200) : "";
      const validEmail = EMAIL_RE.test(cleanEmail) ? cleanEmail : null;
      if (validEmail) await admin.from("orders").update({ customer_email: validEmail }).eq("id", row.order_id);
      const { data: o } = await admin
        .from("orders")
        .select("tracking_token, restaurant_id, items, total, takeaway_number")
        .eq("id", row.order_id)
        .maybeSingle();
      if (o?.tracking_token) {
        const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
        trackingUrl = `${origin.replace(/\/$/, "")}/suivi/${o.tracking_token}`;
        if (validEmail) {
          const { data: r } = await admin.from("restaurants").select("name").eq("id", o.restaurant_id).maybeSingle();
          const res = await sendOrderConfirmationEmail({
            to: validEmail,
            restaurantName: r?.name || "Casa Di Nathano",
            number: o.takeaway_number,
            isDelivery: Boolean(delivery),
            items: o.items,
            total: o.total,
            trackingUrl,
          });
          emailSent = Boolean(res?.sent);
        }
      }
    } catch (err) {
      console.error("[suivi] email/lien:", err?.message || err);
    }
  }

  return NextResponse.json({
    orderId: row?.order_id ?? null,
    takeawayNumber: row?.takeaway_number ?? null,
    trackingUrl,
    emailSent,
    ...(delivery ? { deliveryFee: Number(row?.delivery_fee ?? 0), total: Number(row?.total ?? 0) } : {}),
  });
}
