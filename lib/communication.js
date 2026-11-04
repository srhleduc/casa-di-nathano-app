"use client";

// Accès Supabase de l'espace « Casa communication » (posts réseaux sociaux +
// bibliothèque de visuels). Tables et bucket : supabase/migrations_manual/communication.sql

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const BUCKET = "communication-visuels";

export const POST_STATUSES = [
  { id: "idea", label: "💡 Idée" },
  { id: "draft", label: "✏️ Brouillon" },
  { id: "scheduled", label: "📅 Planifié" },
  { id: "published", label: "✅ Publié" },
];
export const PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
];

const mapPost = (r) => ({
  id: r.id,
  title: r.title,
  caption: r.caption,
  platforms: r.platforms || [],
  restaurantId: r.restaurant_id,
  scheduledFor: r.scheduled_for,
  status: r.status,
  assetIds: r.asset_ids || [],
});
const mapAsset = (r) => ({
  id: r.id,
  name: r.name,
  path: r.path,
  url: r.url,
  mediaType: r.media_type,
  tags: r.tags || [],
});

function useTable(table, order, mapper) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from(table).select("*").order(order.column, { ascending: order.ascending });
    if (error) setError(error.message);
    else {
      setError(null);
      setRows(data.map(mapper));
    }
    setLoading(false);
  }, [table, order.column, order.ascending, mapper]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { rows, loading, error, reload };
}

const POST_ORDER = { column: "created_at", ascending: false };
const ASSET_ORDER = { column: "created_at", ascending: false };

export const useCommunicationPosts = () => useTable("communication_posts", POST_ORDER, mapPost);
export const useCommunicationAssets = () => useTable("communication_assets", ASSET_ORDER, mapAsset);

export async function savePost(post) {
  const row = {
    title: post.title.trim(),
    caption: post.caption,
    platforms: post.platforms,
    restaurant_id: post.restaurantId || null,
    scheduled_for: post.scheduledFor || null,
    status: post.status,
    asset_ids: post.assetIds,
    updated_at: new Date().toISOString(),
  };
  const q = post.id
    ? supabase.from("communication_posts").update(row).eq("id", post.id)
    : supabase.from("communication_posts").insert(row);
  const { error } = await q;
  if (error) throw error;
}

export async function deletePost(id) {
  const { error } = await supabase.from("communication_posts").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadAsset(file) {
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
