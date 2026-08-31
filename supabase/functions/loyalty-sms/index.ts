// Envoi des SMS fidélité via l'API OVH SMS. Déclenchée par pg_net depuis des
// triggers Postgres (voir supabase/schema.sql, section « SMS FIDÉLITÉ ») :
//   - AFTER INSERT sur promo_codes  (reason palier_150 / anniversaire)
//   - AFTER INSERT sur loyalty_customers (message de bienvenue)
//
// Corps attendu : { event: "promo_code" | "new_customer", id: "<uuid>" }
//
// Déployée avec `supabase functions deploy loyalty-sms --no-verify-jwt`
// (appelée uniquement depuis Postgres, jamais depuis le navigateur).
//
// Garde-fous (secrets) :
//   LOYALTY_SMS_ENABLED       "true" pour envoyer réellement ; sinon la fonction
//                             journalise seulement dans loyalty_messages
//                             (statut = 'en_attente') sans appeler OVH.
//   LOYALTY_SMS_TEST_RECIPIENT si défini, TOUS les SMS partent vers ce numéro.
//
// Autres secrets : OVH_APP_KEY, OVH_APP_SECRET, OVH_CONSUMER_KEY, OVH_SMS_SERVICE,
//   OVH_SMS_SENDER, OVH_API_BASE (défaut https://eu.api.ovh.com/1.0),
//   OVH_SMS_NO_STOP_CLAUSE ("true" pour omettre « STOP au … »),
//   LOYALTY_BRAND_NAME (défaut « Casa Di Nathano »).
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY sont injectés d'office par Supabase.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const OVH_API_BASE = Deno.env.get("OVH_API_BASE") || "https://eu.api.ovh.com/1.0";
const OVH_APP_KEY = Deno.env.get("OVH_APP_KEY") || "";
const OVH_APP_SECRET = Deno.env.get("OVH_APP_SECRET") || "";
const OVH_CONSUMER_KEY = Deno.env.get("OVH_CONSUMER_KEY") || "";
const OVH_SMS_SERVICE = Deno.env.get("OVH_SMS_SERVICE") || "";
const OVH_SMS_SENDER = Deno.env.get("OVH_SMS_SENDER") || "";
const NO_STOP_CLAUSE = Deno.env.get("OVH_SMS_NO_STOP_CLAUSE") === "true";

const SMS_ENABLED = Deno.env.get("LOYALTY_SMS_ENABLED") === "true";
const TEST_RECIPIENT = Deno.env.get("LOYALTY_SMS_TEST_RECIPIENT") || "";
const BRAND = Deno.env.get("LOYALTY_BRAND_NAME") || "Casa Di Nathano";

// clé de gabarit -> loyalty_message_templates.key ET loyalty_messages.type
const TEMPLATE_BY_REASON: Record<string, string> = {
  palier_150: "recompense_150",
  anniversaire: "anniversaire",
};
const MESSAGE_TYPE: Record<string, string> = {
  recompense_150: "recompense",
  anniversaire: "anniversaire",
  bienvenue: "bienvenue",
};

async function sha1hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 0XXXXXXXXX -> +33XXXXXXXXX ; +… / 0033… gérés ; le reste renvoyé tel quel.
function toE164(raw: string): string {
  const s = String(raw || "").replace(/[\s.\-()]/g, "");
  if (s.startsWith("+")) return s;
  if (s.startsWith("0033")) return "+" + s.slice(2);
  if (/^0[1-9]\d{8}$/.test(s)) return "+33" + s.slice(1);
  return s;
}

function frDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

function render(body: string, vars: Record<string, string>): string {
  let out = body || "";
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v ?? "");
  out = out.replace(/\{[a-zA-Z_]+\}/g, "");     // placeholders non fournis -> vides
  out = out.replace(/[ \t]{2,}/g, " ");         // espaces multiples (placeholder vidé) -> un seul
  out = out.replace(/[ \t]+\n/g, "\n");          // espaces en fin de ligne
  return out.trim();
}

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  let payload: { event?: string; id?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "corps invalide" });
  }
  const event = payload?.event;
  const id = payload?.id;
  if (!event || !id) return json({ error: "event/id manquant" });

  try {
    let customerId: string;
    let templateKey: string;
    let code = "";
    let expiration = "";

    if (event === "promo_code") {
      const { data: bon } = await supabase
        .from("promo_codes")
        .select("customer_id, code, reason, expires_at")
        .eq("id", id)
        .maybeSingle();
      if (!bon?.customer_id) return json({ skipped: "bon introuvable" });
      templateKey = TEMPLATE_BY_REASON[bon.reason as string];
      if (!templateKey) return json({ skipped: `reason ${bon.reason} non éligible` });
      customerId = bon.customer_id as string;
      code = (bon.code as string) || "";
      expiration = bon.expires_at ? frDate(bon.expires_at as string) : "";
    } else if (event === "new_customer") {
      customerId = id;
      templateKey = "bienvenue";
    } else {
      return json({ skipped: `event ${event} inconnu` });
    }

    const { data: tpl } = await supabase
      .from("loyalty_message_templates")
      .select("body, enabled")
      .eq("key", templateKey)
      .maybeSingle();
    if (!tpl?.body || !tpl.enabled) return json({ skipped: `gabarit ${templateKey} absent ou désactivé` });

    const { data: customer } = await supabase
      .from("loyalty_customers")
      .select("phone, nom")
      .eq("id", customerId)
      .maybeSingle();
    if (!customer?.phone) return json({ skipped: "client sans téléphone" });

    const prenom = String(customer.nom || "").trim().split(/\s+/)[0] || "";
    const message = render(tpl.body as string, { restaurant: BRAND, prenom, code, expiration });
    const messageType = MESSAGE_TYPE[templateKey] || "promo";
    const recipient = toE164(TEST_RECIPIENT || (customer.phone as string));

    // Garde-fou : envoi désactivé -> on journalise seulement.
    if (!SMS_ENABLED) {
      await supabase.from("loyalty_messages").insert({
        customer_id: customerId,
        type: messageType,
        contenu: message,
        statut: "en_attente",
      });
      return json({ simulated: true, recipient, message });
    }

    const result = await sendOvhSms(recipient, message);

    await supabase.from("loyalty_messages").insert({
      customer_id: customerId,
      type: messageType,
      contenu: result.ok ? message : `[ECHEC] ${message} -- ${(result.error || "").slice(0, 300)}`,
      statut: result.ok ? "envoye" : "echec",
      sent_at: result.ok ? new Date().toISOString() : null,
    });

    return json(result);
  } catch (err) {
    console.error("loyalty-sms:", err);
    return json({ error: String((err as Error)?.message || err) });
  }
});

// Toujours 200 pour pg_net : le détail est dans le corps JSON.
function json(obj: unknown): Response {
  return new Response(JSON.stringify(obj), { headers: { "Content-Type": "application/json" } });
}

async function sendOvhSms(
  receiver: string,
  message: string,
): Promise<{ ok: boolean; ids?: unknown; error?: string }> {
  if (!OVH_APP_KEY || !OVH_APP_SECRET || !OVH_CONSUMER_KEY || !OVH_SMS_SERVICE || !OVH_SMS_SENDER) {
    return { ok: false, error: "secrets OVH incomplets" };
  }

  // Horodatage serveur OVH (recommandé pour la signature) ; repli sur l'heure locale.
  let timestamp = String(Math.floor(Date.now() / 1000));
  try {
    const t = (await (await fetch(`${OVH_API_BASE}/auth/time`)).text()).trim();
    if (/^\d+$/.test(t)) timestamp = t;
  } catch {
    // repli déjà en place
  }

  const method = "POST";
  const url = `${OVH_API_BASE}/sms/${OVH_SMS_SERVICE}/jobs`;
  const body = JSON.stringify({
    sender: OVH_SMS_SENDER,
    message,
    receivers: [receiver],
    noStopClause: NO_STOP_CLAUSE,
    charset: "UTF-8",
    priority: "high",
  });

  const signature =
    "$1$" +
    (await sha1hex([OVH_APP_SECRET, OVH_CONSUMER_KEY, method, url, body, timestamp].join("+")));

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Ovh-Application": OVH_APP_KEY,
        "X-Ovh-Consumer": OVH_CONSUMER_KEY,
        "X-Ovh-Timestamp": timestamp,
        "X-Ovh-Signature": signature,
      },
      body,
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `HTTP ${res.status} ${text.slice(0, 400)}` };

    let parsed: { ids?: unknown[]; invalidReceivers?: unknown[] } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      // laissé vide
    }
    if (Array.isArray(parsed.ids) && parsed.ids.length > 0) return { ok: true, ids: parsed.ids };
    return {
      ok: false,
      error: `aucun id renvoyé (invalidReceivers: ${JSON.stringify(parsed.invalidReceivers ?? [])}) ${text.slice(0, 300)}`,
    };
  } catch (err) {
    return { ok: false, error: "fetch: " + String((err as Error)?.message || err) };
  }
}
