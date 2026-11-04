"use client";

import { useEffect, useMemo, useState } from "react";
import {
  deletePost,
  PLATFORM_LABELS,
  POST_STATUSES,
  publishPostNow,
  useCommunicationAssets,
  useCommunicationPosts,
  usePostResults,
} from "@/lib/communication";
import { useRestaurantsList } from "@/lib/restaurant";
import { AssetThumb } from "./AssetLibrary";
import PostForm from "./PostForm";

const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "Sans date";

export default function PostsBoard({ accounts }) {
  const { rows: posts, loading, error, reload } = useCommunicationPosts();
  const { rows: results, reload: reloadResults } = usePostResults();
  const { rows: assets } = useCommunicationAssets();
  const restaurants = useRestaurantsList();
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState(null); // null | "new" | post
  const [copiedId, setCopiedId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const assetsById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const restaurantName = (id) => restaurants.find((r) => r.id === id)?.name || "Enseigne ?";
  const accountLabel = (id) => {
    const a = accountsById.get(id);
    return a ? `${restaurantName(a.restaurantId)} · ${PLATFORM_LABELS[a.platform]}` : "Compte supprimé";
  };

  // Rafraîchit toutes les 30 s : la publication se fait côté serveur, hors de cet écran.
  useEffect(() => {
    const t = setInterval(() => {
      reload();
      reloadResults();
    }, 30000);
    return () => clearInterval(t);
  }, [reload, reloadResults]);

  const visible = useMemo(() => {
    const list = filter === "all" ? posts : posts.filter((p) => p.status === filter);
    return [...list].sort((a, b) => {
      if (a.scheduledAt && b.scheduledAt) return a.scheduledAt.localeCompare(b.scheduledAt);
      if (a.scheduledAt) return -1;
      if (b.scheduledAt) return 1;
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
    if (!window.confirm(`Supprimer le post « ${post.title} » ? S'il est déjà publié, il reste en ligne sur les réseaux.`)) return;
    try {
      await deletePost(post.id);
      await reload();
    } catch (err) {
      console.error(err);
      setActionError(`Suppression impossible : ${err.message || err}`);
    }
  }

  async function publishNow(post, retry) {
    const targets = post.accountIds.map(accountLabel).join(", ");
    const question = retry ? `Réessayer la publication de « ${post.title} » ?` : `Publier « ${post.title} » maintenant sur : ${targets} ?`;
    if (!window.confirm(question)) return;
    setBusyId(post.id);
    setActionError(null);
    try {
      await publishPostNow(post.id);
    } catch (err) {
      console.error(err);
      setActionError(err.message || String(err));
    } finally {
      setBusyId(null);
      await Promise.all([reload(), reloadResults()]);
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
      {actionError && <p className="text-sm text-[#e88a8a] mb-3">{actionError}</p>}
      {loading && <p className="text-sm text-[#8a7561]">Chargement…</p>}
      {!loading && visible.length === 0 && <p className="text-sm text-[#8a7561]">Aucun post ici pour l'instant.</p>}

      <div className="flex flex-col gap-3 max-w-3xl">
        {visible.map((p) => {
          const attached = p.assetIds.map((id) => assetsById.get(id)).filter(Boolean);
          const status = POST_STATUSES.find((s) => s.id === p.status);
          const postResults = results.filter((r) => r.postId === p.id);
          const locked = p.status === "publishing" || p.status === "published";
          const canPublish = p.accountIds.length > 0 && !locked;
          return (
            <div key={p.id} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#a88f78] mb-1">
                <span className="font-bold text-[#f0c860]">{fmtDateTime(p.scheduledAt)}</span>
                <span>· {status?.label}</span>
              </div>
              <div className="font-bold mb-1">{p.title}</div>
              {p.caption && <p className="text-sm text-[#c9b8a4] whitespace-pre-line line-clamp-4">{p.caption}</p>}
              {attached.length > 0 && (
                <div className="flex gap-2 mt-3 overflow-x-auto">
                  {attached.map((a) => <AssetThumb key={a.id} asset={a} className="w-16 h-16 rounded-lg shrink-0" />)}
                </div>
              )}

              {p.accountIds.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1 text-xs">
                  {p.accountIds.map((accId) => {
                    const r = postResults.find((x) => x.accountId === accId);
                    const mark = r?.status === "published" ? "✅" : r?.status === "failed" ? "⚠️" : r?.status === "pending" ? "⏳" : "•";
                    return (
                      <li key={accId} className={r?.status === "failed" ? "text-[#e88a8a]" : "text-[#c9b8a4]"}>
                        {mark} {accountLabel(accId)}
                        {r?.status === "failed" && r.error ? ` — ${r.error}` : ""}
                        {r?.status === "pending" ? " — traitement en cours" : ""}
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="flex flex-wrap gap-4 mt-3 text-xs font-bold">
                {!locked && <button onClick={() => setEditing(p)} className="underline text-[#c9b8a4]">Modifier</button>}
                {canPublish && p.status !== "failed" && (
                  <button onClick={() => publishNow(p, false)} disabled={busyId === p.id} className="underline text-[#f0c860] disabled:opacity-40">
                    {busyId === p.id ? "Publication…" : "Publier maintenant"}
                  </button>
                )}
                {canPublish && p.status === "failed" && (
                  <button onClick={() => publishNow(p, true)} disabled={busyId === p.id} className="underline text-[#f0c860] disabled:opacity-40">
                    {busyId === p.id ? "Nouvelle tentative…" : "Réessayer"}
                  </button>
                )}
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
          accounts={accounts}
          restaurants={restaurants}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
            reloadResults();
          }}
        />
      )}
    </div>
  );
}
