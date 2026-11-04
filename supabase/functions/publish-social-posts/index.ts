// Publie sur Facebook / Instagram les posts de « Casa communication » arrivés à échéance.
//
// Deux modes :
//   - sans corps (cron pg_net toutes les 5 min) : traite les posts `scheduled` dont l'heure est passée ;
//   - { post_id } + jeton d'un compte Direction : « Publier maintenant » / « Réessayer » sur un post.
//
// Règles : un compte déjà publié n'est jamais republié ; un compte en échec n'est retenté que sur
// demande explicite (évite les doublons si Meta a publié mais répondu en erreur) ; les vidéos
// Instagram (Reels) peuvent mettre du temps à être traitées : le compte reste « pending » et la
// publication reprend au passage suivant du cron.
//
// Secrets : META_GRAPH_VERSION (défaut v25.0). SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY injectés d'office.
// Déployée avec verify_jwt=false (appelée par pg_net) ; le mode { post_id } vérifie le compte Direction.

import { createClient } from "npm:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const GRAPH = `https://graph.facebook.com/${Deno.env.get("META_GRAPH_VERSION") || "v25.0"}`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const STALE_MS = 15 * 60 * 1000;
const MAX_PENDING_RUNS = 24; // ~2 h de traitement vidéo à raison d'un passage toutes les 5 min

class GraphError extends Error {
  code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.code = code;
  }
}
class Pending extends Error {
  containerId: string;
  constructor(containerId: string) {
    super("Traitement en cours côté Instagram");
    this.containerId = containerId;
  }
}

async function call(path: string, token: string, params?: Record<string, string>, method = "POST") {
  const res =
    method === "GET"
      ? await fetch(`${GRAPH}/${path}?` + new URLSearchParams({ ...(params || {}), access_token: token }))
      : await fetch(`${GRAPH}/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ ...(params || {}), access_token: token }),
        });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new GraphError(body.error?.message || `Meta a répondu HTTP ${res.status}`, body.error?.code);
  return body;
}

type Asset = { id: string; url: string; media_type: string };
type Account = { id: string; platform: string; external_id: string; name: string; access_token: string };
type Post = { id: string; caption: string; asset_ids: string[]; account_ids: string[]; status: string };

function splitAssets(assets: Asset[]) {
  return { images: assets.filter((a) => a.media_type !== "video"), videos: assets.filter((a) => a.media_type === "video") };
}

async function publishFacebook(acc: Account, caption: string, assets: Asset[]): Promise<string> {
  const { images, videos } = splitAssets(assets);
  const t = acc.access_token;
  const page = acc.external_id;
  if (images.length && videos.length) throw new Error("Facebook : impossible de mélanger photos et vidéo dans un même post.");
  if (videos.length > 1) throw new Error("Facebook : une seule vidéo par post.");
  if (videos.length === 1) return (await call(`${page}/videos`, t, { file_url: videos[0].url, description: caption })).id;
  if (images.length === 0) {
    if (!caption.trim()) throw new Error("Le post est vide (ni texte ni visuel).");
    return (await call(`${page}/feed`, t, { message: caption })).id;
  }
  if (images.length === 1) {
    const r = await call(`${page}/photos`, t, { url: images[0].url, caption });
    return r.post_id || r.id;
  }
  const params: Record<string, string> = { message: caption };
  for (let i = 0; i < images.length; i++) {
    const r = await call(`${page}/photos`, t, { url: images[i].url, published: "false" });
    params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: r.id });
  }
  return (await call(`${page}/feed`, t, params)).id;
}

// Renvoie true si le conteneur Instagram est prêt ; lève une erreur s'il est refusé.
async function waitContainer(id: string, token: string, tries: number): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    const s = await call(id, token, { fields: "status_code,status" }, "GET");
    if (s.status_code === "FINISHED") return true;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") {
      throw new Error(`Instagram a refusé le média : ${s.status || s.status_code}`);
    }
    await sleep(5000);
  }
  return false;
}

async function publishInstagram(
  acc: Account,
  caption: string,
  assets: Asset[],
  priorContainer: string | null,
  saveContainer: (id: string) => Promise<void>
): Promise<string> {
  const { images, videos } = splitAssets(assets);
  const t = acc.access_token;
  const ig = acc.external_id;
  let container = priorContainer;

  if (!container) {
    if (assets.length === 0) throw new Error("Instagram exige au moins un visuel (photo ou vidéo).");
    if (videos.length > 1 || (videos.length && images.length)) {
      throw new Error("Instagram : une seule vidéo par post, sans photo.");
    }
    if (videos.length === 1) {
      container = (await call(`${ig}/media`, t, { media_type: "REELS", video_url: videos[0].url, caption })).id;
    } else if (images.length === 1) {
      container = (await call(`${ig}/media`, t, { image_url: images[0].url, caption })).id;
    } else {
      if (images.length > 10) throw new Error("Instagram : 10 photos maximum par carrousel.");
      const children: string[] = [];
      for (const img of images) {
        const c = (await call(`${ig}/media`, t, { image_url: img.url, is_carousel_item: "true" })).id;
        if (!(await waitContainer(c, t, 6))) throw new Error("Instagram met trop de temps à traiter une photo du carrousel.");
        children.push(c);
      }
      container = (await call(`${ig}/media`, t, { media_type: "CAROUSEL", children: children.join(","), caption })).id;
    }
    await saveContainer(container!);
  }

  if (!(await waitContainer(container!, t, 12))) throw new Pending(container!);
  return (await call(`${ig}/media_publish`, t, { creation_id: container! })).id;
}

async function processPost(post: Post, force: boolean) {
  const { data: assetRows } = await admin.from("communication_assets").select("id,url,media_type").in("id", post.asset_ids);
  const byId = new Map((assetRows || []).map((a: Asset) => [a.id, a]));
  const assets = post.asset_ids.map((id) => byId.get(id)).filter(Boolean) as Asset[];

  const { data: accRows } = await admin
    .from("social_accounts")
    .select("id,platform,external_id,name,access_token")
    .in("id", post.account_ids);
  const accounts = new Map((accRows || []).map((a: Account) => [a.id, a]));

  const { data: resRows } = await admin.from("communication_post_results").select("*").eq("post_id", post.id);
  const prior = new Map((resRows || []).map((r: any) => [r.account_id, r]));

  const outcome: Record<string, string> = {};
  for (const accountId of post.account_ids) {
    const before: any = prior.get(accountId);
    if (before?.status === "published") {
      outcome[accountId] = "published";
      continue;
    }
    if (before?.status === "failed" && !force) {
      outcome[accountId] = "failed";
      continue;
    }
    const acc = accounts.get(accountId);
    const attempts = before?.status === "pending" ? (before.attempts || 0) + 1 : 1;
    const save = (fields: Record<string, unknown>) =>
      admin
        .from("communication_post_results")
        .upsert(
          { post_id: post.id, account_id: accountId, attempts, updated_at: new Date().toISOString(), ...fields },
          { onConflict: "post_id,account_id" }
        );

    if (!acc) {
      await save({ status: "failed", error: "Compte déconnecté ou supprimé.", container_id: null });
      outcome[accountId] = "failed";
      continue;
    }
    try {
      let externalId: string;
      if (acc.platform === "facebook") {
        externalId = await publishFacebook(acc, post.caption, assets);
      } else {
        externalId = await publishInstagram(acc, post.caption, assets, before?.container_id || null, async (id) => {
          await save({ status: "pending", container_id: id, error: null });
        });
      }
      await save({ status: "published", external_id: externalId, container_id: null, error: null });
      outcome[accountId] = "published";
    } catch (err) {
      if (err instanceof Pending && attempts < MAX_PENDING_RUNS) {
        await save({ status: "pending", container_id: err.containerId, error: null });
        outcome[accountId] = "pending";
      } else {
        let message = err instanceof Error ? err.message : String(err);
        if (err instanceof Pending) message = "Instagram met trop de temps à traiter la vidéo.";
        if (err instanceof GraphError && err.code === 190) {
          message = "La connexion à ce compte a expiré : reconnecte-le dans l'onglet Comptes.";
          await admin.from("social_accounts").update({ status: "error" }).eq("id", accountId);
        }
        await save({ status: "failed", error: message.slice(0, 500), container_id: null });
        outcome[accountId] = "failed";
      }
    }
  }

  const values = Object.values(outcome);
  let status = "failed";
  if (values.includes("pending")) status = "scheduled"; // reprise au prochain passage du cron
  else if (values.every((v) => v === "published")) status = "published";
  await admin
    .from("communication_posts")
    .update({ status, publishing_started_at: null, ...(status === "published" ? { published_at: new Date().toISOString() } : {}) })
    .eq("id", post.id);
  return status;
}

// Réserve le post pour éviter une double publication (cron + clic manuel simultanés).
async function claim(id: string, statuses: string[], staleBefore?: string): Promise<Post | null> {
  let q = admin
    .from("communication_posts")
    .update({ status: "publishing", publishing_started_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", statuses);
  if (staleBefore) q = q.lt("publishing_started_at", staleBefore);
  const { data } = await q.select("id,caption,asset_ids,account_ids,status");
  return data && data.length ? (data[0] as Post) : null;
}

async function isManager(req: Request): Promise<boolean> {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return false;
  const { data } = await admin.auth.getUser(jwt);
  const uid = data?.user?.id;
  if (!uid) return false;
  const { data: m } = await admin.from("managers").select("auth_uid").eq("auth_uid", uid).maybeSingle();
  return Boolean(m);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let body: { post_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    // corps vide : appel du cron
  }

  if (body.post_id) {
    if (!(await isManager(req))) return json({ error: "Accès réservé à la Direction." }, 401);
    const { data: current } = await admin.from("communication_posts").select("account_ids").eq("id", body.post_id).maybeSingle();
    if (!current) return json({ error: "Post introuvable." }, 404);
    if (!current.account_ids?.length) return json({ error: "Choisis au moins un compte avant de publier." }, 400);
    const post = await claim(body.post_id, ["idea", "draft", "scheduled", "failed"]);
    if (!post) return json({ error: "Ce post est déjà en cours de publication ou publié." }, 409);
    const status = await processPost(post, true);
    return json({ status });
  }

  const nowIso = new Date().toISOString();
  const staleIso = new Date(Date.now() - STALE_MS).toISOString();
  const { data: due } = await admin
    .from("communication_posts")
    .select("id,status,account_ids")
    .or(`and(status.eq.scheduled,scheduled_at.lte.${nowIso}),and(status.eq.publishing,publishing_started_at.lt.${staleIso})`)
    .limit(20);

  const results: Record<string, string> = {};
  for (const row of due || []) {
    if (!row.account_ids?.length) continue;
    const post = row.status === "publishing" ? await claim(row.id, ["publishing"], staleIso) : await claim(row.id, ["scheduled"]);
    if (!post) continue;
    results[post.id] = await processPost(post, false);
  }
  return json({ processed: results });
});
