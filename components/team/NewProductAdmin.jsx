"use client";

import { useState } from "react";
import { useCustomMenuItems, insertCustomMenuItem, deleteCustomMenuItem, uploadMenuPhoto } from "@/lib/data";
import { CATEGORIES, INGREDIENT_NAMES, eur } from "@/lib/menu";

export default function NewProductAdmin() {
  const { customMenuItems } = useCustomMenuItems();
  const [name, setName] = useState("");
  const [cat, setCat] = useState("pizza");
  const [price, setPrice] = useState("");
  const [ingredients, setIngredients] = useState([]);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoLoading, setPhotoLoading] = useState(false);

  function toggleIngredient(n) {
    setIngredients((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoLoading(true);
    try {
      const url = await uploadMenuPhoto(file);
      setPhotoUrl(url);
    } catch (err) {
      console.error(err);
      alert("Échec de l'envoi de la photo — réessaie, ou colle un lien à la place ci-dessous.");
    } finally {
      setPhotoLoading(false);
    }
  }

  function createProduct() {
    if (!name.trim() || price === "") return;
    insertCustomMenuItem({
      name: name.trim(),
      price: parseFloat(price) || 0,
      cat,
      ingredients: cat === "pizza" ? ingredients : undefined,
      photoUrl: photoUrl.trim() || null,
    }).catch((err) => console.error(err));
    setName("");
    setPrice("");
    setIngredients([]);
    setPhotoUrl("");
  }

  function removeProduct(id) {
    deleteCustomMenuItem(id).catch((err) => console.error(err));
  }

  const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="rounded-2xl border border-[#3a2b1f] p-5 mb-8">
        <div className="font-bold mb-4">Créer un nouveau produit</div>

        <div className="mb-4">
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Nom du produit</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Tartufo" className="w-full rounded-lg px-3 py-3" style={inputStyle} />
        </div>

        <div className="mb-4">
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Catégorie</div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2"
                style={cat === c.key ? { borderColor: "#C0392B", background: "#2c1c14" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Prix (€)</div>
          <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" step="0.1" placeholder="Ex. 15.5" className="w-40 rounded-lg px-3 py-3" style={inputStyle} />
        </div>

        {cat === "pizza" && (
          <div className="mb-4">
            <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Ingrédients (pour permettre "retirer un ingrédient")</div>
            <div className="flex flex-wrap gap-2">
              {INGREDIENT_NAMES.map((n) => {
                const on = ingredients.includes(n);
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
          {photoUrl && !photoLoading && <img src={photoUrl} alt="aperçu" className="w-full h-32 object-cover rounded-lg" />}
          <div className="text-xs text-[#5a4a3a] mt-2 mb-1">Le sélecteur ci-dessus ne marche pas ? Colle un lien à la place :</div>
          <input
            value={photoUrl && photoUrl.startsWith("http") ? photoUrl : ""}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg px-3 py-3 text-sm"
            style={inputStyle}
          />
        </div>

        <button onClick={createProduct} className="tap-scale w-full rounded-xl py-4 font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
          Ajouter au menu
        </button>
      </div>

      <div className="font-bold mb-3">Produits ajoutés ({customMenuItems.length})</div>
      {customMenuItems.length === 0 && <p className="text-[#8a7561]">Aucun produit personnalisé pour l'instant.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {customMenuItems.map((item) => (
          <div key={item.id} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4 flex items-center justify-between">
            <div>
              <div className="font-bold">{item.name}</div>
              <div className="text-xs text-[#a88f78]">
                {CATEGORIES.find((c) => c.key === item.cat)?.label} · {eur(item.price)}
                {item.photoUrl ? " · 📷" : ""}
              </div>
            </div>
            <button onClick={() => removeProduct(item.id)} className="tap-scale text-xs text-red-400 font-bold">
              Supprimer
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
