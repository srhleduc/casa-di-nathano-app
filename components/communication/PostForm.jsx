"use client";

import { useState } from "react";
import { PLATFORMS, POST_STATUSES, savePost } from "@/lib/communication";
import AssetLibrary from "./AssetLibrary";

const FIELD = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };

export default function PostForm({ initial, restaurants, onClose, onSaved }) {
  const [post, setPost] = useState(
    initial || { title: "", caption: "", platforms: ["instagram"], restaurantId: "", scheduledFor: "", status: "idea", assetIds: [] }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [pickingAssets, setPickingAssets] = useState(false);

  const set = (patch) => setPost((p) => ({ ...p, ...patch }));
  const toggleIn = (key, id) =>
    set({ [key]: post[key].includes(id) ? post[key].filter((x) => x !== id) : [...post[key], id] });

  async function submit(e) {
    e.preventDefault();
    if (!post.title.trim()) {
      setError("Donne un titre au post.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await savePost(post);
      onSaved();
    } catch (err) {
      console.error(err);
      setError(`Échec de l'enregistrement : ${err.message || err}`);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70">
      <form
        onSubmit={submit}
        className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: "#1a120b", border: "1px solid #3a2b1f" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="display-font text-xl font-semibold">{post.id ? "Modifier le post" : "Nouveau post"}</h2>
          <button type="button" onClick={onClose} className="text-[#c9b8a4] text-sm px-3 py-1">Fermer</button>
        </div>

        <input value={post.title} onChange={(e) => set({ title: e.target.value })} placeholder="Titre (ex. Pizza Mont d'Or)"
          className="rounded-xl px-4 py-3 outline-none" style={FIELD} />
        <textarea value={post.caption} onChange={(e) => set({ caption: e.target.value })} placeholder="Texte du post (légende, hashtags…)"
          rows={6} className="rounded-xl px-4 py-3 outline-none" style={FIELD} />

        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <button key={p.id} type="button" onClick={() => toggleIn("platforms", p.id)}
              className={`tap-scale rounded-full px-4 py-2 text-sm font-bold border-2 ${post.platforms.includes(p.id) ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <select value={post.restaurantId || ""} onChange={(e) => set({ restaurantId: e.target.value })} className="rounded-xl px-3 py-3 outline-none" style={FIELD}>
            <option value="">Les deux enseignes</option>
            {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select value={post.status} onChange={(e) => set({ status: e.target.value })} className="rounded-xl px-3 py-3 outline-none" style={FIELD}>
            {POST_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <label className="flex flex-col gap-1 text-xs text-[#a88f78]">
          Date de publication prévue
          <input type="date" value={post.scheduledFor || ""} onChange={(e) => set({ scheduledFor: e.target.value })}
            className="rounded-xl px-4 py-3 outline-none text-base" style={FIELD} />
        </label>

        <div>
          <button type="button" onClick={() => setPickingAssets((v) => !v)}
            className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2 border-[#3a2b1f]">
            🖼️ Visuels joints ({post.assetIds.length}) {pickingAssets ? "▲" : "▼"}
          </button>
          {pickingAssets && (
            <div className="mt-3">
              <AssetLibrary selectedIds={post.assetIds} onToggle={(id) => toggleIn("assetIds", id)} />
            </div>
          )}
        </div>

        {error && <p className="text-sm text-[#e88a8a]">{error}</p>}
        <button type="submit" disabled={saving} className="tap-scale rounded-full py-4 text-lg font-bold disabled:opacity-50"
          style={{ background: "#C0392B", color: "#fff5ea" }}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
