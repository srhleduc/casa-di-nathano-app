"use client";

// Accès Supabase de l'espace « Casa communication » : posts, visuels, comptes Meta
// (Facebook / Instagram) et publication automatique.
// Tables, bucket et Edge Functions : supabase/migrations_manual/communication*.sql,
// supabase/functions/meta-connect, supabase/functions/publish-social-posts.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const BUCKET = "communication-visuels";

// Tous les statuts (filtres + affichage) ; seuls les trois premiers se choisissent à la main.
export const POST_STATUSES = [
  { id: "idea", label: "💡 Idée" },
  { id: "draft", label: "✏️ Brouillon" },
  { id: "scheduled", label: "📅 Planifié" },
  { id: "publishing", label: "⏳ En cours" },
  { id: "published", label: "✅ Publié" },
  { id: "failed", label: "⚠️ Échec" },
];
export const EDITABLE_STATUSES = POST_STATUSES.slice(0, 3);
export const PLATFORM_LABELS = { facebook: "Facebook", instagram: "Instagram" };

const mapPost = (r) => ({
  id: r.id,
  title: r.title,
  caption: r.caption,
  scheduledAt: r.scheduled_at,
  status: r.status,
  assetIds: r.asset_ids || [],
  accountIds: r.account_ids || [],
});
const mapAsset = (r) => ({
  id: r.id,
  name: r.name,
  path: r.path,
  url: r.url,
  mediaType: r.media_type,
  tags: r.tags || [],
});
const mapAccount = (r) => ({
  id: r.id,
  platform: r.platform,
  externalId: r.external_id,
  name: r.name,
  restaurantId: r.restaurant_id,
  status: r.status,
});
const mapResult = (r) => ({
  postId: r.post_id,
  accountId: r.account_id,
  status: r.status,
  error: r.error,
});

function useTable(table, columns, order, mapper) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    let q = supabase.from(table).select(columns);
    if (order) q = q.order(order.column, { ascending: order.ascending });
    const { data, error } = await q;
    if (error) setError(error.message);
    else {
      setError(null);
      setRows(data.map(mapper));
    }
    setLoading(false);
  }, [table, columns, order, mapper]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { rows, loading, error, reload };
}

const NEWEST_FIRST = { column: "created_at", ascending: false };
const NAME_ASC = { column: "name", ascending: true };
// Les jetons d'accès ne sont pas lisibles depuis le navigateur : colonnes listées explicitement.
const ACCOUNT_COLUMNS = "id,platform,external_id,name,restaurant_id,status";

export const useCommunicationPosts = () => useTable("communication_posts", "*", NEWEST_FIRST, mapPost);
export const useCommunicationAssets = () => useTable("communication_assets", "*", NEWEST_FIRST, mapAsset);
export const useSocialAccounts = () => useTable("social_accounts", ACCOUNT_COLUMNS, NAME_ASC, mapAccount);
export const usePostResults = () => useTable("communication_post_results", "*", null, mapResult);

// ---- Posts ----------------------------------------------------------------

// <input type="datetime-local"> <-> ISO (heure locale de l'appareil)
export const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null);

export async function savePost(post, accounts) {
  const chosen = accounts.filter((a) => post.accountIds.includes(a.id));
  const restaurantIds = [...new Set(chosen.map((a) => a.restaurantId).filter(Boolean))];
  const row = {
    title: post.title.trim(),
    caption: post.caption,
    scheduled_at: fromLocalInput(post.scheduledAtLocal),
    status: post.status,
    asset_ids: post.assetIds,
    account_ids: post.accountIds,
    // colonnes historiques, gardées cohérentes
    platforms: [...new Set(chosen.map((a) => a.platform))],
    restaurant_id: restaurantIds.length === 1 ? restaurantIds[0] : null,
    updated_at: new Date().toISOString(),
  };
  const q = post.id
    ? supabase.from("communication_posts").update(row).eq("id", post.id)
    : supabase.from("communication_posts").insert(row);
  const { error } = await q;
  if (error) throw error;
  // Replanifier un post en échec : on efface les échecs pour que ces comptes soient retentés.
  if (post.id && post.status === "scheduled") {
    await supabase.from("communication_post_results").delete().eq("post_id", post.id).eq("status", "failed");
  }
}

export async function deletePost(id) {
  const { error } = await supabase.from("communication_posts").delete().eq("id", id);
  if (error) throw error;
}

async function functionError(error) {
  try {
    const body = await error.context?.json?.();
    if (body?.error) return new Error(body.error);
  } catch {
    // corps illisible
  }
  return new Error(error.message || "Échec de l'appel serveur.");
}

async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw await functionError(error);
  return data;
}

// « Publier maintenant » et « Réessayer » : publication immédiate sur les comptes ciblés.
export const publishPostNow = (postId) => invoke("publish-social-posts", { post_id: postId });

// ---- Comptes Meta -----------------------------------------------------------

const STATE_KEY = "casa_meta_oauth_state";
const redirectUri = () => `${window.location.origin}/api/meta/callback`;

export async function startMetaConnect() {
  const state = crypto.randomUUID();
  window.localStorage.setItem(STATE_KEY, state);
  const { url } = await invoke("meta-connect", { action: "login_url", redirect_uri: redirectUri(), state });
  window.location.assign(url);
}

// À appeler au retour de Facebook (?meta_code=…&meta_state=…).
export async function completeMetaConnect(code, state) {
  const expected = window.localStorage.getItem(STATE_KEY);
  window.localStorage.removeItem(STATE_KEY);
  if (!expected || expected !== state) throw new Error("Connexion Facebook invalide ou expirée, réessaie.");
  return invoke("meta-connect", { action: "exchange", redirect_uri: redirectUri(), code });
}

export async function setAccountRestaurant(id, restaurantId) {
  const { error } = await supabase.from("social_accounts").update({ restaurant_id: restaurantId || null }).eq("id", id);
  if (error) throw error;
}

export async function disconnectAccount(id) {
  const { error } = await supabase.from("social_accounts").delete().eq("id", id);
  if (error) throw error;
}

// ---- Visuels ---------------------------------------------------------------

// Instagram n'accepte que le JPEG : les PNG/WebP/HEIC sont convertis à l'import.
async function toJpegIfNeeded(file) {
  if (!file.type.startsWith("image/") || file.type === "image/jpeg") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export async function uploadAsset(original) {
  const file = await toJpegIfNeeded(original);
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const { error } = await supabase.from("communication_assets").insert({
    name: file.name,
    path,
    url: data.publicUrl,
    media_type: file.type.startsWith("video/") ? "video" : "image",
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
}

export async function updateAssetTags(id, tags) {
  const { error } = await supabase.from("communication_assets").update({ tags }).eq("id", id);
  if (error) throw error;
}

export async function deleteAsset(asset) {
  const { error: dbErr } = await supabase.from("communication_assets").delete().eq("id", asset.id);
  if (dbErr) throw dbErr;
  await supabase.storage.from(BUCKET).remove([asset.path]);
}
