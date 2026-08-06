"use client";

import { useRef, useState } from "react";
import { useMenu, insertMenuItem, updateMenuItem, deleteMenuItem, uploadMenuPhoto } from "@/lib/data";
import { CATEGORIES, eur, newMenuItemId } from "@/lib/menu";

function ingredientNamesFromMenu(menuItems) {
  return menuItems
    .filter((m) => m.cat === "sans")
    .map((m) => m.name.replace("Sans ", ""))
    .sort();
}

const EMPTY_FORM = { name: "", cat: "pizza", price: "", ingredients: [], photoUrl: "" };

export default function MenuAdmin() {
  const { menuItems } = useMenu();
  const [browseCat, setBrowseCat] = useState("pizza");
  const [editingId, setEditingId] = useState(null); // null = mode création
  const [form, setForm] = useState(EMPTY_FORM);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const formRef = useRef(null);

  const ingredientNames = ingredientNamesFromMenu(menuItems);
  const items = menuItems.filter((m) => m.cat === browseCat).sort((a, b) => a.name.localeCompare(b.name));

  function startEdit(item) {
    setEditingId(item.id);
    setConfirmingDeleteId(null);
    setForm({
      name: item.name,
      cat: item.cat,
      price: String(item.price),
      ingredients: item.ingredients || [],
      photoUrl: item.photoUrl || "",
    });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function toggleIngredient(n) {
    setForm((f) => ({ ...f, ingredients: f.ingredients.includes(n) ? f.ingredients.filter((x) => x !== n) : [...f.ingredients, n] }));
  }

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoLoading(true);
    try {
      const url = await uploadMenuPhoto(file);
      setForm((f) => ({ ...f, photoUrl: url }));
    } catch (err) {
      console.error(err);
      alert("Échec de l'envoi de la photo — réessaie, ou colle un lien à la place ci-dessous.");
    } finally {
      setPhotoLoading(false);
    }
  }

  async function save() {
    if (!form.name.trim() || form.price === "") return;
    const payload = {
      name: form.name.trim(),
      price: parseFloat(form.price) || 0,
      cat: form.cat,
      ingredients: form.cat === "pizza" ? form.ingredients : undefined,
      photoUrl: form.photoUrl.trim() || null,
    };
    try {
      if (editingId) {
        await updateMenuItem(editingId, payload);
      } else {
        await insertMenuItem({ id: newMenuItemId(form.cat, form.name), ...payload });
      }
      setBrowseCat(form.cat);
      cancelEdit();
    } catch (err) {
      console.error(err);
      alert("Échec de l'enregistrement du produit.");
    }
  }

  function removeItem(id) {
    deleteMenuItem(id).catch((err) => console.error(err));
    setConfirmingDeleteId(null);
    if (editingId === id) cancelEdit();
  }

  const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div ref={formRef} className={`rounded-2xl border p-5 mb-8 ${editingId ? "border-[#C0392B]" : "border-[#3a2b1f]"}`}>
        <div className="font-bold mb-4">{editingId ? `Modifier « ${form.name} »` : "Créer un nouveau produit"}</div>

        <div className="mb-4">
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Nom du produit</div>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex. Tartufo" className="w-full rounded-lg px-3 py-3" style={inputStyle} />
        </div>

        <div className="mb-4">
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Catégorie</div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setForm({ ...form, cat: c.key })}
                className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2"
                style={form.cat === c.key ? { borderColor: "#C0392B", background: "#2c1c14" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Prix (€)</div>
          <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} type="number" step="0.1" placeholder="Ex. 15.5" className="w-40 rounded-lg px-3 py-3" style={inputStyle} />
        </div>

        {form.cat === "pizza" && (
          <div className="mb-4">
            <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Ingrédients (pour permettre "retirer un ingrédient")</div>
            <div className="flex flex-wrap gap-2">
              {ingredientNames.map((n) => {
                const on = form.ingredients.includes(n);
                return (
                  <button
                    key={n}
                    onClick={() => toggleIngredient(n)}
                    className="tap-scale rounded-full px-3 py-1.5 text-xs font-bold border-2"
                    style={on ? { borderColor: "#C0392B", background: "#2c1c14", color: "#fff5ea" } : { borderColor: "#3a2b1f", color: "#a88f78" }}
                  >
                    {on ? "✓ " : ""}
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-5">
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Photo (visible uniquement côté client)</div>
          <input type="file" accept="image/*" onChange={handleFile} className="w-full rounded-lg px-3 py-3 mb-2 text-sm" style={inputStyle} />
          {photoLoading && <p className="text-xs text-[#a88f78]">Envoi de la photo…</p>}
          {form.photoUrl && !photoLoading && <img src={form.photoUrl} alt="aperçu" className="w-full h-32 object-cover rounded-lg" />}
          <div className="text-xs text-[#5a4a3a] mt-2 mb-1">Le sélecteur ci-dessus ne marche pas ? Colle un lien à la place :</div>
          <input
            value={form.photoUrl && form.photoUrl.startsWith("http") ? form.photoUrl : ""}
            onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
            placeholder="https://..."
            className="w-full rounded-lg px-3 py-3 text-sm"
            style={inputStyle}
          />
        </div>

        <div className="flex gap-3">
          <button onClick={save} className="tap-scale flex-1 rounded-xl py-4 font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
            {editingId ? "Enregistrer les modifications" : "Ajouter au menu"}
          </button>
          {editingId && (
            <button onClick={cancelEdit} className="tap-scale rounded-xl py-4 px-5 font-bold border-2 border-[#3a2b1f]">
              Annuler
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-3 mb-5 overflow-x-auto">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setBrowseCat(c.key)}
            className={`tap-scale shrink-0 rounded-full px-5 py-2 font-bold border-2 text-sm ${browseCat === c.key ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      <div className="font-bold mb-3">
        {CATEGORIES.find((c) => c.key === browseCat)?.label} ({items.length})
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-bold truncate">{item.name}</div>
              <div className="text-xs text-[#a88f78]">
                {eur(item.price)}
                {item.photoUrl ? " · 📷" : ""}
                {item.ingredients?.length ? ` · ${item.ingredients.length} ingr.` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => startEdit(item)} className="tap-scale text-xs font-bold rounded-full px-3 py-2 border-2 border-[#3a2b1f]">
                ✏️ Modifier
              </button>
              {confirmingDeleteId === item.id ? (
                <button onClick={() => removeItem(item.id)} className="tap-scale text-xs font-bold rounded-full px-3 py-2" style={{ background: "#C0392B", color: "#fff5ea" }}>
                  Confirmer ?
                </button>
              ) : (
                <button onClick={() => setConfirmingDeleteId(item.id)} className="tap-scale text-xs text-red-400 font-bold">
                  Supprimer
                </button>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-[#8a7561]">Aucun produit dans cette catégorie.</p>}
      </div>
    </div>
  );
}
