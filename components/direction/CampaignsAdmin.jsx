"use client";

// Espace Direction → Campagnes : créer / modifier / supprimer les campagnes
// affichées au client du click & collect au début de sa commande, juste après
// l'écran d'accueil et avant le menu (ex. vente de panettone pour Noël).
//
// Une campagne = un titre + un texte (+ une photo) + deux boutons : « Je
// réserve le mien avec ma commande » (ajoute au panier les produits liés que le
// client choisit, avec leur quantité) et « Passer à la commande ». On choisit les
// produits du menu à réserver (un ou plusieurs, ou aucun pour une simple annonce), les restaurants et la période. Appliqué aussitôt
// sur le click & collect (voir components/CampaignModal.jsx). Logique
// d'affichage : lib/campaigns.js.

import { useMemo, useState } from "react";
import { eur } from "@/lib/menu";
import { useMenu, useCampaigns, insertCampaign, updateCampaign, deleteCampaign, uploadMenuPhoto } from "@/lib/data";
import { useRestaurantsList } from "@/lib/restaurant";
import { describeCampaignPeriod, isCampaignActive } from "@/lib/campaigns";

const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };
const DEFAULT_RESERVE_LABEL = "Je réserve le mien avec ma commande";
const DEFAULT_SKIP_LABEL = "Passer à la commande";

const EMPTY_DRAFT = {
  id: null,
  name: "",
  title: "",
  description: "",
  imageUrl: "",
  menuItemIds: [],
  reserveLabel: DEFAULT_RESERVE_LABEL,
  skipLabel: DEFAULT_SKIP_LABEL,
  restaurantIds: [],
  startDate: "",
  endDate: "",
  active: true,
};

function toDraft(c) {
  return {
    id: c.id,
    name: c.name,
    title: c.title,
    description: c.description || "",
    imageUrl: c.imageUrl || "",
    menuItemIds: [...c.menuItemIds],
    reserveLabel: c.reserveLabel,
    skipLabel: c.skipLabel,
    restaurantIds: [...c.restaurantIds],
    startDate: c.startDate || "",
    endDate: c.endDate || "",
    active: c.active,
  };
}

function chipStyle(on) {
  return on ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]";
}

// ------------------------------------------------------------ composants --

function CampaignEditor({ initial, menu, restaurants, onClose }) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const sortedMenu = useMemo(() => [...menu].sort((a, b) => a.name.localeCompare(b.name)), [menu]);
  const menuById = useMemo(() => new Map(menu.map((m) => [m.id, m])), [menu]);
  const linkedItems = draft.menuItemIds.map((id) => menuById.get(id)).filter(Boolean);
  const hasProducts = draft.menuItemIds.length > 0;
  const addableItems = sortedMenu.filter((m) => !draft.menuItemIds.includes(m.id));
  const allRestaurants = draft.restaurantIds.length === 0;
  const previewImage = draft.imageUrl || (linkedItems.length === 1 ? linkedItems[0].photoUrl : null) || null;

  function toggleRestaurant(id) {
    set({ restaurantIds: draft.restaurantIds.includes(id) ? draft.restaurantIds.filter((x) => x !== id) : [...draft.restaurantIds, id] });
  }

  async function onPickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      set({ imageUrl: await uploadMenuPhoto(file) });
    } catch (err) {
      console.error(err);
      setError("Échec de l'envoi de la photo.");
    }
    setUploading(false);
  }

  function validate() {
    if (!draft.title.trim()) return "Écris le titre affiché au client.";
    if (linkedItems.length < draft.menuItemIds.length) return "Un des produits choisis n'existe plus au menu — retire-le de la liste.";
    if (hasProducts && !draft.reserveLabel.trim()) return "Écris le texte du bouton de réservation.";
    if (!draft.skipLabel.trim()) return "Écris le texte du bouton pour continuer.";
    if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) return "La date de fin est avant la date de début.";
    return "";
  }

  async function save() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setSaving(true);
    const payload = {
      name: draft.name.trim() || draft.title.trim(),
      title: draft.title.trim(),
      description: draft.description.trim(),
      imageUrl: draft.imageUrl || null,
      menuItemIds: draft.menuItemIds,
      reserveLabel: draft.reserveLabel.trim() || DEFAULT_RESERVE_LABEL,
      skipLabel: draft.skipLabel.trim() || DEFAULT_SKIP_LABEL,
      restaurantIds: draft.restaurantIds,
      startDate: draft.startDate || null,
      endDate: draft.endDate || null,
      active: draft.active,
    };
    try {
      if (draft.id) await updateCampaign(draft.id, payload);
      else await insertCampaign({ ...payload, sortOrder: 1000 });
      onClose();
    } catch (err) {
      console.error(err);
      setError("Échec de l'enregistrement — la table « campaigns » existe-t-elle bien dans Supabase ?");
      setSaving(false);
    }
  }

  const section = "text-xs text-[#a88f78] uppercase font-bold mb-2";

  return (
    <div className="rounded-2xl border border-[#C0392B] p-5 mb-8">
      <div className="display-font text-xl font-bold mb-5">{draft.id ? "Modifier la campagne" : "Nouvelle campagne"}</div>

      <label className="block mb-5">
        <div className={section}>Titre affiché au client</div>
        <input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ex. 🎄 Nos panettones de Noël" className="w-full rounded-lg px-3 py-2 font-bold" style={inputStyle} />
      </label>
      <label className="block mb-5">
        <div className={section}>Texte (facultatif)</div>
        <textarea
          value={draft.description}
          onChange={(e) => set({ description: e.target.value })}
          rows={3}
          placeholder="Ex. Une idée cadeau gourmande, faite maison. Réserve le tien maintenant, tu le récupères avec ta commande."
          className="w-full rounded-lg px-3 py-2"
          style={inputStyle}
        />
      </label>

      <div className={section}>Produits à réserver</div>
      {linkedItems.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {linkedItems.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-2 rounded-full border-2 border-[#C0392B] bg-[#2c1c14] pl-4 pr-2 py-1 text-sm font-bold">
              {m.name} · {eur(m.price)}
              <button
                onClick={() => set({ menuItemIds: draft.menuItemIds.filter((id) => id !== m.id) })}
                aria-label={`Retirer ${m.name}`}
                className="tap-scale w-7 h-7 rounded-full bg-[#3a2b1f] font-bold"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      {draft.menuItemIds.length > linkedItems.length && (
        <p className="text-xs text-[#e8806f] mb-3">Certains produits choisis n'existent plus au menu — enregistre après les avoir retirés.</p>
      )}
      <select
        value=""
        onChange={(e) => e.target.value && set({ menuItemIds: [...draft.menuItemIds, e.target.value] })}
        className="w-full rounded-lg px-3 py-2 mb-2"
        style={inputStyle}
      >
        <option value="">{hasProducts ? "+ Ajouter un autre produit…" : "+ Ajouter un produit… (sinon : simple annonce, un seul bouton)"}</option>
        {addableItems.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} — {eur(m.price)}
          </option>
        ))}
      </select>
      <p className="text-xs text-[#8a7561] mb-5">
        Les produits doivent exister au menu (Équipe → Menu) avec leur prix — un produit par parfum / format. Le client choisit la quantité de
        chacun. Un produit en rupture ou déjà dans le panier n'est pas proposé ; s'il n'en reste aucun, la campagne n'est pas affichée.
      </p>

      <div className={section}>Photo (facultatif)</div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {previewImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewImage} alt="" className="w-24 h-24 rounded-xl object-cover border border-[#3a2b1f]" />
        )}
        <label className="tap-scale rounded-full px-5 py-2 text-sm font-bold border-2 border-[#3a2b1f] cursor-pointer">
          {uploading ? "Envoi…" : draft.imageUrl ? "Changer la photo" : "Ajouter une photo"}
          <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} disabled={uploading} />
        </label>
        {draft.imageUrl && (
          <button onClick={() => set({ imageUrl: "" })} className="tap-scale rounded-full px-5 py-2 text-sm font-bold border-2 border-[#3a2b1f] text-[#e8806f]">
            Retirer
          </button>
        )}
        {!draft.imageUrl && linkedItems.length === 1 && linkedItems[0].photoUrl && <span className="text-xs text-[#8a7561]">Sans photo, celle du produit est utilisée.</span>}
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        {hasProducts && (
          <label className="flex-1 min-w-[220px]">
            <div className={section}>Bouton « je réserve »</div>
            <input value={draft.reserveLabel} onChange={(e) => set({ reserveLabel: e.target.value })} className="w-full rounded-lg px-3 py-2" style={inputStyle} />
          </label>
        )}
        <label className="flex-1 min-w-[220px]">
          <div className={section}>{hasProducts ? "Bouton « passer »" : "Bouton pour continuer"}</div>
          <input value={draft.skipLabel} onChange={(e) => set({ skipLabel: e.target.value })} className="w-full rounded-lg px-3 py-2" style={inputStyle} />
        </label>
      </div>

      <div className={section}>Période d'affichage</div>
      <div className="flex flex-wrap gap-3 mb-1">
        <label>
          <div className="text-xs text-[#8a7561] mb-1">Du</div>
          <input type="date" value={draft.startDate} onChange={(e) => set({ startDate: e.target.value })} className="rounded-lg px-3 py-2" style={inputStyle} />
        </label>
        <label>
          <div className="text-xs text-[#8a7561] mb-1">Au (inclus)</div>
          <input type="date" value={draft.endDate} onChange={(e) => set({ endDate: e.target.value })} className="rounded-lg px-3 py-2" style={inputStyle} />
        </label>
      </div>
      <p className="text-xs text-[#8a7561] mb-5">Laisse vide pour ne pas limiter. Si tu ne mets pas de date de fin, désactive la campagne à la main quand la vente se termine.</p>

      <div className={section}>Restaurants</div>
      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={() => set({ restaurantIds: [] })} aria-pressed={allRestaurants} className={`tap-scale rounded-full px-5 py-2 font-bold border-2 ${chipStyle(allRestaurants)}`}>
          Tous
        </button>
        {restaurants.map((r) => {
          const on = draft.restaurantIds.includes(r.id);
          return (
            <button key={r.id} onClick={() => toggleRestaurant(r.id)} aria-pressed={on} className={`tap-scale rounded-full px-5 py-2 font-bold border-2 ${chipStyle(on)}`}>
              {r.name}
            </button>
          );
        })}
      </div>

      <button onClick={() => set({ active: !draft.active })} aria-pressed={draft.active} className={`tap-scale rounded-full px-5 py-2 font-bold border-2 mb-6 ${chipStyle(draft.active)}`}>
        {draft.active ? "✅ Campagne active" : "⏸️ Campagne désactivée"}
      </button>

      {error && <p className="text-sm text-[#e8806f] mb-3">{error}</p>}
      <div className="flex gap-3">
        <button onClick={save} disabled={saving || uploading} className="tap-scale rounded-full px-8 py-3 font-bold disabled:opacity-50" style={{ background: "#C0392B", color: "#fff5ea" }}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button onClick={onClose} disabled={saving} className="tap-scale rounded-full px-8 py-3 font-bold border-2 border-[#3a2b1f]">
          Annuler
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ page --

export default function CampaignsAdmin() {
  const { campaigns, loading } = useCampaigns();
  const { menuItems } = useMenu();
  const restaurants = useRestaurantsList();
  const [editing, setEditing] = useState(null); // null | draft
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

  const menuById = useMemo(() => new Map(menuItems.map((m) => [m.id, m])), [menuItems]);
  const restaurantName = (id) => restaurants.find((r) => r.id === id)?.name || id;

  async function remove(id) {
    setConfirmingDeleteId(null);
    try {
      await deleteCampaign(id);
    } catch (err) {
      console.error(err);
      alert("Échec de la suppression.");
    }
  }
  async function toggleActive(c) {
    try {
      await updateCampaign(c.id, { active: !c.active });
    } catch (err) {
      console.error(err);
    }
  }
  async function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= campaigns.length) return;
    const arr = [...campaigns];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    try {
      await Promise.all(arr.map((c, idx) => (c.sortOrder === idx ? null : updateCampaign(c.id, { sortOrder: idx }))));
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <p className="text-[#a88f78] text-sm mb-6 max-w-3xl">
        Les campagnes (ex. <b>vente de panettone pour Noël</b>) s'affichent au client du click &amp; collect au tout début de sa
        commande, avant le menu : il peut <b>réserver le produit avec sa commande</b> ou <b>passer directement</b>. Chaque campagne n'est proposée
        qu'une fois par commande. Appliqué aussitôt, sans redéploiement.
      </p>

      {editing ? (
        <CampaignEditor key={editing.id || "new"} initial={editing} menu={menuItems} restaurants={restaurants} onClose={() => setEditing(null)} />
      ) : (
        <button onClick={() => setEditing({ ...EMPTY_DRAFT })} className="tap-scale rounded-full px-6 py-3 font-bold mb-6" style={{ background: "#C0392B", color: "#fff5ea" }}>
          + Nouvelle campagne
        </button>
      )}

      {loading && <p className="text-[#8a7561]">Chargement…</p>}
      {!loading && campaigns.length === 0 && !editing && <p className="text-[#8a7561]">Aucune campagne pour l'instant.</p>}

      <div className="flex flex-col gap-3">
        {campaigns.map((c, i) => {
          const linked = c.menuItemIds.map((id) => menuById.get(id)).filter(Boolean);
          const missing = c.menuItemIds.length - linked.length;
          const liveNow = isCampaignActive(c);
          return (
            <div key={c.id} className={`rounded-2xl border border-[#3a2b1f] bg-[#211712] p-5 ${c.active ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                <div>
                  <div className="display-font text-xl font-bold">{c.title}</div>
                  {c.description && <div className="text-sm text-[#a88f78] whitespace-pre-line">{c.description}</div>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="tap-scale w-9 h-9 rounded-full bg-[#3a2b1f] font-bold disabled:opacity-30" aria-label="Monter">
                    ↑
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === campaigns.length - 1} className="tap-scale w-9 h-9 rounded-full bg-[#3a2b1f] font-bold disabled:opacity-30" aria-label="Descendre">
                    ↓
                  </button>
                </div>
              </div>
              <div className="text-sm text-[#c9b8a4] flex flex-col gap-1 mb-4">
                <div>
                  {c.active ? (liveNow ? "🟢 Affichée en ce moment" : "🕒 Active, hors période d'affichage") : "⏸️ Désactivée"}
                  {" · "}
                  {describeCampaignPeriod(c)}
                </div>
                <div>{c.restaurantIds.length === 0 ? "Tous les restaurants" : c.restaurantIds.map(restaurantName).join(", ")}</div>
                <div className="text-[#a88f78]">
                  {c.menuItemIds.length === 0
                    ? "📣 Annonce seule"
                    : `🛒 Réservation de : ${linked.map((m) => `${m.name} (${eur(m.price)})`).join(", ") || "—"}`}
                  {missing > 0 && <div className="text-[#e8806f]">⚠️ {missing} produit{missing > 1 ? "s" : ""} introuvable{missing > 1 ? "s" : ""} au menu</div>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setEditing(toDraft(c))} className="tap-scale rounded-full px-5 py-2 text-sm font-bold border-2 border-[#3a2b1f]">
                  ✏️ Modifier
                </button>
                <button onClick={() => toggleActive(c)} className="tap-scale rounded-full px-5 py-2 text-sm font-bold border-2 border-[#3a2b1f]">
                  {c.active ? "⏸️ Désactiver" : "▶️ Activer"}
                </button>
                {confirmingDeleteId === c.id ? (
                  <>
                    <button onClick={() => remove(c.id)} className="tap-scale rounded-full px-5 py-2 text-sm font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
                      Confirmer la suppression
                    </button>
                    <button onClick={() => setConfirmingDeleteId(null)} className="tap-scale rounded-full px-5 py-2 text-sm font-bold border-2 border-[#3a2b1f]">
                      Annuler
                    </button>
                  </>
                ) : (
                  <button onClick={() => setConfirmingDeleteId(c.id)} className="tap-scale rounded-full px-5 py-2 text-sm font-bold border-2 border-[#3a2b1f] text-[#e8806f]">
                    🗑️ Supprimer
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
