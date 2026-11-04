"use client";

// Bibliothèque de visuels (photos / vidéos courtes) de l'espace communication.
// Mode "sélection" (onPick) réutilisé par le formulaire de post pour joindre des visuels.

import { useRef, useState } from "react";
import { deleteAsset, updateAssetTags, uploadAsset, useCommunicationAssets } from "@/lib/communication";

const PRIMARY_BTN = { background: "#C0392B", color: "#fff5ea" };
const MAX_SIZE_BYTES = 25 * 1024 * 1024;

export function AssetThumb({ asset, className = "" }) {
  return asset.mediaType === "video" ? (
    <video src={asset.url} muted playsInline preload="metadata" className={`object-cover ${className}`} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={asset.url} alt={asset.name} loading="lazy" className={`object-cover ${className}`} />
  );
}

export default function AssetLibrary({ selectedIds, onToggle }) {
  const { rows: assets, loading, error, reload } = useCommunicationAssets();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [filter, setFilter] = useState("");
  const pickMode = typeof onToggle === "function";

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setBusy(true);
    setMsg(null);
    const failures = [];
    for (const file of files) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        failures.push(`${file.name} : ni image ni vidéo`);
        continue;
      }
      if (file.size > MAX_SIZE_BYTES) {
        failures.push(`${file.name} : plus de 25 Mo`);
        continue;
      }
      try {
        await uploadAsset(file);
      } catch (err) {
        console.error(err);
        failures.push(`${file.name} : ${err.message || "échec"}`);
      }
    }
    await reload();
    setBusy(false);
    if (failures.length) setMsg(failures.join(" · "));
  }

  async function handleDelete(asset) {
    if (!window.confirm(`Supprimer « ${asset.name} » ? Les posts qui l'utilisent la perdront.`)) return;
    try {
      await deleteAsset(asset);
      await reload();
    } catch (err) {
      console.error(err);
      setMsg(`Suppression impossible : ${err.message || err}`);
    }
  }

  async function handleTags(asset) {
    const input = window.prompt("Étiquettes (séparées par des virgules)", asset.tags.join(", "));
    if (input === null) return;
    const tags = input.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    try {
      await updateAssetTags(asset.id, tags);
      await reload();
    } catch (err) {
      console.error(err);
      setMsg(`Échec : ${err.message || err}`);
    }
  }

  const q = filter.trim().toLowerCase();
  const visible = q
    ? assets.filter((a) => a.name.toLowerCase().includes(q) || a.tags.some((t) => t.includes(q)))
    : assets;

  return (
    <div className={pickMode ? "" : "flex-1 overflow-y-auto px-6 py-6"}>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple onChange={handleFiles} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="tap-scale rounded-full px-5 py-3 text-sm font-bold disabled:opacity-40"
          style={PRIMARY_BTN}
        >
          {busy ? "Import en cours…" : "＋ Ajouter des visuels"}
        </button>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Rechercher (nom, étiquette)"
          className="flex-1 min-w-[10rem] rounded-xl px-4 py-3 text-sm outline-none"
          style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
        />
      </div>
      {!pickMode && <p className="text-[#8a7561] text-xs mb-4">Photos et vidéos courtes, 25 Mo maximum chacune.</p>}
      {msg && <p className="text-xs text-[#e88a8a] mb-3">{msg}</p>}
      {error && <p className="text-xs text-[#e88a8a] mb-3">Chargement impossible : {error}</p>}
      {loading && <p className="text-sm text-[#8a7561]">Chargement…</p>}
      {!loading && visible.length === 0 && (
        <p className="text-sm text-[#8a7561]">{assets.length === 0 ? "Aucun visuel pour l'instant." : "Aucun résultat."}</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {visible.map((a) => {
          const selected = pickMode && selectedIds.includes(a.id);
          return (
            <div
              key={a.id}
              className="rounded-xl overflow-hidden border-2 bg-[#211712]"
              style={{ borderColor: selected ? "#C0392B" : "#3a2b1f" }}
            >
              <button
                type="button"
                onClick={pickMode ? () => onToggle(a.id) : () => window.open(a.url, "_blank", "noopener")}
                className="block w-full tap-scale"
              >
                <AssetThumb asset={a} className="w-full aspect-square" />
              </button>
              <div className="p-2">
                <div className="text-[11px] text-[#c9b8a4] truncate">{a.name}</div>
                {a.tags.length > 0 && <div className="text-[10px] text-[#8a7561] truncate">#{a.tags.join(" #")}</div>}
                {!pickMode && (
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => handleTags(a)} className="text-[11px] text-[#c9b8a4] underline">Étiquettes</button>
                    <button onClick={() => handleDelete(a)} className="text-[11px] text-[#e88a8a] underline">Supprimer</button>
                  </div>
                )}
                {pickMode && selected && <div className="text-[11px] font-bold text-[#C0392B]">✓ Joint</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
