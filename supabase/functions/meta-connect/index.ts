// Connexion des comptes Meta (pages Facebook + comptes Instagram professionnels liés)
// à « Casa communication ». Appelée depuis le navigateur par un compte Direction connecté.
//
// Corps attendu :
//   { action: "login_url", redirect_uri, state }   -> { url } (page de connexion Facebook)
//   { action: "exchange", redirect_uri, code }      -> échange le code, stocke les pages/comptes
//
// Secrets : META_APP_ID, META_APP_SECRET (Supabase → Edge Functions → Secrets),
//   META_GRAPH_VERSION (défaut v25.0). SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY sont injectés d'office.
// Déployée avec verify_jwt=false : l'appelant est vérifié ici (compte présent dans `managers`).
// Les jetons ne sont jamais renvoyés au navigateur ni journalisés.

import { createClient } from "npm:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const APP_ID = Deno.env.get("META_APP_ID") || "";
const APP_SECRET = Deno.env.get("META_APP_SECRET") || "";
const GRAPH = `https://graph.facebook.com/${Deno.env.get("META_GRAPH_VERSION") || "v25.0"}`;

const SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
].join(",");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function isManager(req: Request): Promise<boolean> {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return false;
  const { data } = await admin.auth.getUser(jwt);
  const uid = data?.user?.id;
  if (!uid) return false;
  const { data: m } = await admin.from("managers").select("auth_uid").eq("auth_uid", uid).maybeSingle();
  return Boolean(m);
}

async function graph(url: string) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(body.error?.message || `Meta a répondu HTTP ${res.status}`);
  return body;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!(await isManager(req))) return json({ error: "Accès réservé à la Direction." }, 401);
  if (!APP_ID || !APP_SECRET) return json({ error: "Meta n'est pas configuré (META_APP_ID / META_APP_SECRET manquants)." }, 500);

  let body: Record<string, string> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Requête invalide." }, 400);
  }
  const redirectUri = body.redirect_uri;
  if (!redirectUri) return json({ error: "redirect_uri manquant." }, 400);

  if (body.action === "login_url") {
    const url =
      "https://www.facebook.com/dialog/oauth?" +
      new URLSearchParams({ client_id: APP_ID, redirect_uri: redirectUri, state: body.state || "", scope: SCOPES, response_type: "code" });
    return json({ url });
  }

  if (body.action === "exchange") {
    if (!body.code) return json({ error: "code manquant." }, 400);
    try {
      const short = await graph(
        `${GRAPH}/oauth/access_token?` +
          new URLSearchParams({ client_id: APP_ID, client_secret: APP_SECRET, redirect_uri: redirectUri, code: body.code })
      );
      // Jeton utilisateur longue durée : les jetons de page qui en découlent n'expirent pas.
      const long = await graph(
        `${GRAPH}/oauth/access_token?` +
          new URLSearchParams({
            grant_type: "fb_exchange_token",
            client_id: APP_ID,
            client_secret: APP_SECRET,
            fb_exchange_token: short.access_token,
          })
      );
      const pages = await graph(
        `${GRAPH}/me/accounts?` +
          new URLSearchParams({
            fields: "id,name,access_token,instagram_business_account{id,username}",
            limit: "100",
            access_token: long.access_token,
          })
      );

      const rows: Record<string, unknown>[] = [];
      for (const p of pages.data || []) {
        rows.push({ platform: "facebook", external_id: p.id, name: p.name, access_token: p.access_token, status: "ok" });
        const ig = p.instagram_business_account;
        if (ig?.id) {
          rows.push({
            platform: "instagram",
            external_id: ig.id,
            name: ig.username ? `@${ig.username}` : p.name,
            access_token: p.access_token,
            status: "ok",
          });
        }
      }
      if (rows.length === 0) {
        return json({ error: "Aucune page Facebook trouvée. Vérifie que tu as bien coché tes pages pendant la connexion." }, 422);
      }
      // restaurant_id n'est pas dans les colonnes écrites : l'enseigne déjà choisie est conservée.
      const { error } = await admin.from("social_accounts").upsert(rows, { onConflict: "platform,external_id" });
      if (error) throw new Error(error.message);
      return json({ accounts: rows.map((r) => ({ platform: r.platform, name: r.name })) });
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : String(err) }, 502);
    }
  }

  return json({ error: "Action inconnue." }, 400);
});
