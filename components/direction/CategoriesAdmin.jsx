"use client";

// Espace Direction → Catégories : créer une catégorie de menu (ex. « 🎄 Noël »)
// et activer / désactiver n'importe quelle catégorie.
//
// Une catégorie désactivée disparaît de tous les écrans de commande (borne,
// /commande, /sat, prise de commande équipe) ; ses produits sont conservés et
// reviennent à la réactivation. Les catégories créées ici ne sont que de la
// vente : elles n'ont pas d'écran de préparation (four, boissons, finition) et
// apparaissent sur les tickets dans un dernier groupe. L'ordre des onglets se
// règle dans « Ordre des catégories ». Logique : lib/menuCategories.js.

import { useMemo, useState } from "react";
import { useMenu, useMenuCategories, saveMenuCategory, deleteMenuCategory } from "@/lib/data";
import { uniqueCategoryKey } from "@/lib/menuCategories";

const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };
const section = "text-xs text-[#a88f78] uppercase font-bold mb-2";

function CategoryForm({ initial, onSave, onCancel, saving, error }) {
  const [label, setLabel] = useState(initial?.label || "");
  const [emoji, setEmoji] = useState(initial?.emoji || "🏷️");
  return (
    <div className="rounded-2xl border border-[#C0392B] p-5 mb-6">
      <div className="display-font text-xl font-bold mb-4">{initial ? "Modifier la catégorie" : "Nouvelle catégorie"}</div>
      <div className="flex flex-wrap gap-3 mb-4">
        <label className="w-24">
          <div className={section}>Emoji</div>
          <input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={8} className="w-full rounded-lg px-3 py-2 text-center text-2xl" style={inputStyle} />
        </label>
        <label className="flex-1 min-w-[200px]">
          <div className={section}>Nom</div>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Noël" className="w-full rounded-lg px-3 py-3 font-bold" style={inputStyle} />
        </label>
      </div>
      {error && <p className="text-sm text-[#e8806f] mb-3">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={() => onSave({ label: label.trim(), emoji: emoji.trim() })}
          disabled={saving || !label.trim()}
          className="tap-scale rounded-full px-8 py-3 font-bold disabled:opacity-50"
          style={{ background: "#C0392B", color: "#fff5ea" }}
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button onClick={onCancel} disabled={saving} className="tap-scale rounded-full px-8 py-3 font-bold border-2 border-[#3a2b1f]">
          Annuler
        </button>
      </div>
    </div>
  );
}

export default function CategoriesAdmin() {
  const { allCategories, loading } = useMenuCategories();
  const { menuItems } = useMenu();
  const [editing, setEditing] = useState(null); // null | "new" | clé de la catégorie
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmingOffKey, setConfirmingOffKey] = useState(null);
  const [confirmingDeleteKey, setConfirmingDeleteKey] = useState(null);

  const countByCat = useMemo(() => {
    const m = {};
    for (const it of menuItems) m[it.cat] = (m[it.cat] || 0) + 1;
    return m;
  }, [menuItems]);

  const nextSortOrder = allCategories.reduce((m, c) => Math.max(m, c.sortOrder), -1) + 1;

  async function save(values) {
    setSaving(true);
    setError("");
    try {
      if (editing === "new") {
        const key = uniqueCategoryKey(values.label, allCategories.map((c) => c.key));
        await saveMenuCategory({ key, label: values.label, emoji: values.emoji, active: true, sortOrder: nextSortOrder });
      } else {
        const cat = allCategories.find((c) => c.key === editing);
        await saveMenuCategory({ ...cat, label: values.label, emoji: values.emoji });
      }
      setEditing(null);
    } catch (err) {
      console.error(err);
      setError("Échec de l'enregistrement — la table « menu_categories » existe-t-elle bien dans Supabase ?");
    }
    setSaving(false);
  }

  async function setActive(cat, active) {
    setConfirmingOffKey(null);
    try {
      await saveMenuCategory({ ...cat, active });
    } catch (err) {
      console.error(err);
      alert("Échec de la mise à jour — la table « menu_categories » existe-t-elle bien dans Supabase ?");
    }
  }

  async function remove(key) {
    setConfirmingDeleteKey(null);
    try {
      await deleteMenuCategory(key);
    } catch (err) {
      console.error(err);
      alert("Échec de la suppression.");
    }
  }

  const editingCat = editing && editing !== "new" ? allCategories.find((c) => c.key === editing) : null;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <p className="text-[#a88f78] text-sm mb-6 max-w-3xl">
        Les catégories du menu (pizzas, desserts, boissons…). Tu peux en <b>créer</b> (ex. « 🎄 Noël ») et <b>activer / désactiver</b> chacune :
        une catégorie désactivée disparaît de tous les écrans de commande, mais ses produits sont conservés. Réglage <b>commun aux deux
        restaurants</b>, appliqué aussitôt. L'ordre des onglets se règle dans « Ordre des catégories ».
      </p>

      {editing ? (
        <CategoryForm key={editing} initial={editingCat} onSave={save} onCancel={() => { setEditing(null); setError(""); }} saving={saving} error={error} />
      ) : (
        <button onClick={() => setEditing("new")} className="tap-scale rounded-full px-6 py-3 font-bold mb-6" style={{ background: "#C0392B", color: "#fff5ea" }}>
          + Nouvelle catégorie
        </button>
      )}

      {loading && <p className="text-[#8a7561]">Chargement…</p>}

      <div className="flex flex-col gap-3">
        {allCategories.map((c) => {
          const n = countByCat[c.key] || 0;
          return (
            <div key={c.key} className={`rounded-2xl border border-[#3a2b1f] bg-[#211712] p-5 ${c.active ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="display-font text-xl font-bold">
                  {c.emoji} {c.label}
                </div>
                <div className="text-sm text-[#a88f78]">
                  {n} produit{n > 1 ? "s" : ""} · {c.active ? "🟢 Active" : "⏸️ Désactivée"}
                  {!c.builtin && " · créée par toi"}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { setError(""); setEditing(c.key); }} className="tap-scale rounded-full px-5 py-2 text-sm font-bold border-2 border-[#3a2b1f]">
                  ✏️ Modifier
                </button>
                {c.active ? (
                  confirmingOffKey === c.key ? (
                    <>
                      <button onClick={() => setActive(c, false)} className="tap-scale rounded-full px-5 py-2 text-sm font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
                        Confirmer : masquer des commandes
                      </button>
                      <button onClick={() => setConfirmingOffKey(null)} className="tap-scale rounded-full px-5 py-2 text-sm font-bold border-2 border-[#3a2b1f]">
                        Annuler
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmingOffKey(c.key)} className="tap-scale rounded-full px-5 py-2 text-sm font-bold border-2 border-[#3a2b1f]">
                      ⏸️ Désactiver
                    </button>
                  )
                ) : (
                  <button onClick={() => setActive(c, true)} className="tap-scale rounded-full px-5 py-2 text-sm font-bold border-2 border-[#3a2b1f]">
                    ▶️ Activer
                  </button>
                )}
                {!c.builtin &&
                  (n > 0 ? (
                    <span className="text-xs text-[#8a7561] self-center">Supprimable une fois vide</span>
                  ) : confirmingDeleteKey === c.key ? (
                    <>
                      <button onClick={() => remove(c.key)} className="tap-scale rounded-full px-5 py-2 text-sm font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
                        Confirmer la suppression
                      </button>
                      <button onClick={() => setConfirmingDeleteKey(null)} className="tap-scale rounded-full px-5 py-2 text-sm font-bold border-2 border-[#3a2b1f]">
                        Annuler
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmingDeleteKey(c.key)} className="tap-scale rounded-full px-5 py-2 text-sm font-bold border-2 border-[#3a2b1f] text-[#e8806f]">
                      🗑️ Supprimer
                    </button>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
