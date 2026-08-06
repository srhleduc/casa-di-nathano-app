// Vérifie, pour chaque restaurant, si 3 commandes ou plus attendent
// simultanément au four depuis plus de 15 minutes ; si c'est le cas et que
// l'alerte n'est pas déjà active pour ce restaurant, notifie tous les
// appareils de la Direction par notification push, puis marque l'alerte
// comme active (pour ne pas renotifier tant que ça dure). Se réarme dès que
// le nombre repasse sous 3.
//
// Déclenchée toutes les minutes par pg_cron (voir supabase/schema.sql).
// Déployée avec `supabase functions deploy oven-alert-check --no-verify-jwt`
// (appelée uniquement depuis Postgres via pg_net, jamais depuis le navigateur).

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const THRESHOLD_COUNT = 3;
const THRESHOLD_MINUTES = 15;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:srhleduc@gmail.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: restaurants, error: restaurantsError } = await supabase
    .from("restaurants")
    .select("id, name");
  if (restaurantsError) return new Response(restaurantsError.message, { status: 500 });

  const cutoff = new Date(Date.now() - THRESHOLD_MINUTES * 60_000).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const results = [];

  for (const restaurant of restaurants) {
    const { count, error: countError } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurant.id)
      .eq("is_test", false)
      .in("status", ["attente", "preparation"])
      .is("oven_done_at", null)
      .lt("created_at", cutoff)
      .or(`scheduled_for.is.null,scheduled_for.eq.${today}`);
    if (countError) {
      results.push({ restaurant: restaurant.id, error: countError.message });
      continue;
    }

    const { data: state } = await supabase
      .from("oven_alert_state")
      .select("active")
      .eq("restaurant_id", restaurant.id)
      .single();

    const isLate = (count || 0) >= THRESHOLD_COUNT;

    if (isLate && !state?.active) {
      const pushResults = await notifyManagers(
        supabase,
        `🔥 ${restaurant.name} — embouteillage au four`,
        `${count} commandes attendent depuis plus de ${THRESHOLD_MINUTES} min.`
      );
      await supabase
        .from("oven_alert_state")
        .update({ active: true, triggered_at: new Date().toISOString() })
        .eq("restaurant_id", restaurant.id);
      results.push({ restaurant: restaurant.id, notified: true, count, pushResults });
    } else if (!isLate && state?.active) {
      await supabase.from("oven_alert_state").update({ active: false }).eq("restaurant_id", restaurant.id);
      results.push({ restaurant: restaurant.id, cleared: true });
    } else {
      results.push({ restaurant: restaurant.id, count, active: !!state?.active });
    }
  }

  return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
});

async function notifyManagers(supabase, title, body) {
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key");
  if (!subscriptions || subscriptions.length === 0) return { sent: 0, errors: [] };

  const payload = JSON.stringify({ title, body });
  const outcomes = await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload
        );
        return { id: sub.id, ok: true };
      } catch (err) {
        // Abonnement expiré/révoqué (410/404) : on le supprime pour ne plus
        // réessayer inutilement à chaque déclenchement futur.
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
        return { id: sub.id, ok: false, statusCode: err.statusCode, message: err.body || err.message };
      }
    })
  );
  return { sent: outcomes.filter((o) => o.ok).length, errors: outcomes.filter((o) => !o.ok) };
}
