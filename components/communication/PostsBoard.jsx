"use client";

import { useMemo, useState } from "react";
import { deletePost, PLATFORMS, POST_STATUSES, useCommunicationAssets, useCommunicationPosts } from "@/lib/communication";
import { useRestaurantsList } from "@/lib/restaurant";
import { AssetThumb } from "./AssetLibrary";
import PostForm from "./PostForm";

const fmtDate = (iso) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : "Sans date";

export default function PostsBoard() {
  const { rows: posts, loading, error, reload } = useCommunicationPosts();
  const { rows: assets } = useCommunicationAssets();
  const restaurants = useRestaurantsList();
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState(null); // null | "new" | post
  const [copiedId, setCopiedId] = useState(null);

  const assetsById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const restaurantName = (id) => (id ? restaurants.find((r) => r.id === id)?.name || id : "Les deux enseignes");

  const visible = useMemo(() => {
    const list = filter === "all" ? posts : posts.filter((p) => p.status === filter);
    // Planifiés d'abord par date croissante, puis le reste dans l'ordre de création.
    return [...list].sort((a, b) => {
      if (a.scheduledFor && b.scheduledFor) return a.scheduledFor.localeCompare(b.scheduledFor);
      if (a.scheduledFor) return -1;
      if (b.scheduledFor) return 1;
      return 0;
    });
  }, [posts, filter]);

  async function copyCaption(post) {
    try {
      await navigator.clipboard.writeText(post.caption);
      setCopiedId(post.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error(err);
    }
  }

  async function remove(post) {
    if (!window.confirm(`Supprimer le post « ${post.title} » ?`)) return;
    try {
      await deletePost(post.id);
      await reload();
    } catch (err) {
      console.error(err);
      window.alert(`Suppression impossible : ${err.message || err}`);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {[{ id: "all", label: "Tous" }, ...POST_STATUSES].map((s) => (
          <button key={s.id} onClick={() => setFilter(s.id)}
            className={`tap-scale shrink-0 rounded-full px-4 py-2 text-sm font-bold border-2 ${filter === s.id ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>
            {s.label}
          </button>
        ))}
        <button onClick={() => setEditing("new")} className="tap-scale ml-auto rounded-full px-5 py-2 text-sm font-bold"
          style={{ background: "#C0392B", color: "#fff5ea" }}>
          ＋ Nouveau post
        </button>
      </div>

      {error && <p className="text-xs text-[#e88a8a] mb-3">Chargement impossible : {error}</p>}
      {loading && <p className="text-sm text-[#8a7561]">Chargement…</p>}
      {!loading && visible.length === 0 && <p className="text-sm text-[#8a7561]">Aucun post ici pour l'instant.</p>}

      <div className="flex flex-col gap-3 max-w-3xl">
        {visible.map((p) => {
          const attached = p.assetIds.map((id) => assetsById.get(id)).filter(Boolean);
          const status = POST_STATUSES.find((s) => s.id === p.status);
          return (
            <div key={p.id} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#a88f78] mb-1">
                <span className="font-bold text-[#f0c860]">{fmtDate(p.scheduledFor)}</span>
                <span>· {status?.label}</span>
                <span>· {restaurantName(p.restaurantId)}</span>
                {p.platforms.length > 0 && (
                  <span>· {p.platforms.map((id) => PLATFORMS.find((x) => x.id === id)?.label || id).join(", ")}</span>
                )}
              </div>
              <div className="font-bold mb-1">{p.title}</div>
              {p.caption && <p className="text-sm text-[#c9b8a4] whitespace-pre-line line-clamp-4">{p.caption}</p>}
              {attached.length > 0 && (
                <div className="flex gap-2 mt-3 overflow-x-auto">
                  {attached.map((a) => <AssetThumb key={a.id} asset={a} className="w-16 h-16 rounded-lg shrink-0" />)}
                </div>
              )}
              <div className="flex gap-4 mt-3 text-xs font-bold">
                <button onClick={() => setEditing(p)} className="underline text-[#c9b8a4]">Modifier</button>
                {p.caption && (
                  <button onClick={() => copyCaption(p)} className="underline text-[#c9b8a4]">
                    {copiedId === p.id ? "✓ Copié" : "Copier le texte"}
                  </button>
                )}
                <button onClick={() => remove(p)} className="underline text-[#e88a8a]">Supprimer</button>
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <PostForm
          initial={editing === "new" ? null : editing}
          restaurants={restaurants}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
