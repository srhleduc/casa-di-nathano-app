"use client";

import { useState } from "react";
import { EDITABLE_STATUSES, PLATFORM_LABELS, savePost, toLocalInput, useCommunicationAssets } from "@/lib/communication";
import AssetLibrary from "./AssetLibrary";

const FIELD = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };
const IG_CAPTION_MAX = 2200;

export default function PostForm({ initial, accounts, restaurants, onClose, onSaved }) {
  const [post, setPost] = useState(
    initial
      ? { ...initial, scheduledAtLocal: toLocalInput(initial.scheduledAt) }
      : { title: "", caption: "", scheduledAtLocal: "", status: "idea", assetIds: [], accountIds: [] }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [pickingAssets, setPickingAssets] = useState(false);
  const { rows: assets } = useCommunicationAssets();

  const set = (patch) => setPost((p) => ({ ...p, ...patch }));
  const toggleIn = (key, id) =>
    set({ [key]: post[key].includes(id) ? post[key].filter((x) => x !== id) : [...post[key], id] });
  const restaurantName = (id) => restaurants.find((r) => r.id === id)?.name || "Enseigne non définie";
  const usable = accounts.filter((a) => a.status === "ok");

  // Les statuts posés par le système (en cours / publié / échec) restent affichés tels quels.
  const statusOptions = EDITABLE_STATUSES.some((s) => s.id === post.status)
    ? EDITABLE_STATUSES
    : [...EDITABLE_STATUSES, { id: post.status, label: post.status === "failed" ? "⚠️ Échec" : post.status }];

  function validate() {
    if (!post.title.trim()) return "Donne un titre au post.";
    const chosen = usable.filter((a) => post.accountIds.includes(a.id));
    const picked = post.assetIds.map((id) => assets.find((a) => a.id === id)).filter(Boolean);
    const videos = picked.filter((a) => a.mediaType === "video").length;
    const images = picked.length - videos;
    if (post.status === "scheduled") {
      if (!post.scheduledAtLocal) return "Choisis la date et l'heure de publication.";
      if (new Date(post.scheduledAtLocal).getTime() < Date.now() - 60_000) return "La date de publication est déjà passée.";
      if (chosen.length === 0) return "Choisis au moins un compte sur lequel publier.";
    }
    if (chosen.some((a) => a.platform === "instagram")) {
      if (picked.length === 0) return "Instagram exige au moins une photo ou une vidéo.";
      if (videos > 1 || (videos === 1 && images > 0)) return "Instagram : une seule vidéo, sans photo — ou jusqu'à 10 photos.";
      if (images > 10) return "Instagram : 10 photos maximum.";
      if (post.caption.length > IG_CAPTION_MAX) return `Instagram : texte limité à ${IG_CAPTION_MAX} caractères.`;
    }
    if (chosen.some((a) => a.platform === "facebook") && videos > 0 && images > 0) {
      return "Facebook : impossible de mélanger photos et vidéo.";
    }
    return null;
  }

  async function submit(e) {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await savePost(post, accounts);
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
        <div>
          <textarea value={post.caption} onChange={(e) => set({ caption: e.target.value })} placeholder="Texte du post (légende, hashtags…)"
            rows={6} className="w-full rounded-xl px-4 py-3 outline-none" style={FIELD} />
          <div className="text-right text-[11px] text-[#8a7561]">{post.caption.length} / {IG_CAPTION_MAX}</div>
        </div>

        <div>
          <div className="text-xs text-[#a88f78] mb-2">Publier sur</div>
          {usable.length === 0 ? (
            <p className="text-sm text-[#8a7561]">Aucun compte connecté : va dans l'onglet « Comptes ».</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {usable.map((a) => (
                <button key={a.id} type="button" onClick={() => toggleIn("accountIds", a.id)}
                  className={`tap-scale rounded-full px-4 py-2 text-sm font-bold border-2 ${post.accountIds.includes(a.id) ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>
                  {restaurantName(a.restaurantId)} · {PLATFORM_LABELS[a.platform]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-[#a88f78]">
            Date et heure de publication
            <input type="datetime-local" value={post.scheduledAtLocal} onChange={(e) => set({ scheduledAtLocal: e.target.value })}
              className="rounded-xl px-3 py-3 outline-none text-base" style={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[#a88f78]">
            Statut
            <select value={post.status} onChange={(e) => set({ status: e.target.value })} className="rounded-xl px-3 py-3 outline-none text-base" style={FIELD}>
              {statusOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>
        <p className="text-[11px] text-[#8a7561] -mt-2">
          Passe le statut sur « Planifié » pour que le post parte tout seul à l'heure choisie (vérification toutes les 5 minutes).
        </p>

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
