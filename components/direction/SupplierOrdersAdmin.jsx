"use client";

import { useState } from "react";
import {
  useIngredients,
  useSuppliers,
  insertSupplier,
  deleteSupplier,
  setIngredientSupplier,
  insertIngredient,
} from "@/lib/data";

const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };

function NewIngredientForm({ supplierId }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  async function create() {
    if (!name.trim()) return;
    try {
      await insertIngredient({ name: name.trim(), unit: "g", costPerUnit: 0, supplierId: supplierId ?? null });
      setName("");
      setOpen(false);
    } catch (err) {
      console.error(err);
      alert("Échec de la création de l'ingrédient.");
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="tap-scale rounded-xl py-2 px-4 font-bold border-2 border-[#3a2b1f] text-sm mb-5">
        + Nouvel ingrédient
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[#C0392B] p-4 mb-5 flex flex-wrap gap-3 items-end">
      <div>
        <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Nom de l'ingrédient</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="Ex. Farine complète"
          className="rounded-lg px-3 py-2 w-64"
          style={inputStyle}
          autoFocus
        />
      </div>
      <button onClick={create} className="tap-scale rounded-xl py-2 px-5 font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
        Créer
      </button>
      <button onClick={() => setOpen(false)} className="tap-scale rounded-xl py-2 px-4 font-bold border-2 border-[#3a2b1f]">
        Annuler
      </button>
      <div className="text-xs text-[#5a4a3a] w-full">
        Créé sans coût pour l'instant — complète-le dans Coût de revient quand tu as le prix.
      </div>
    </div>
  );
}

export default function SupplierOrdersAdmin() {
  const { ingredients } = useIngredients();
  const { suppliers } = useSuppliers();
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

  const unassigned = ingredients.filter((i) => !i.supplierId);
  const countBySupplier = Object.fromEntries(suppliers.map((s) => [s.id, ingredients.filter((i) => i.supplierId === s.id).length]));
  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

  async function addSupplier() {
    if (!newSupplierName.trim()) return;
    try {
      await insertSupplier(newSupplierName.trim());
      setNewSupplierName("");
    } catch (err) {
      console.error(err);
      alert("Échec de la création du fournisseur.");
    }
  }

  function removeSupplier(id) {
    deleteSupplier(id).catch((err) => {
      console.error(err);
      alert("Échec de la suppression.");
    });
    setConfirmingDeleteId(null);
    if (selectedSupplierId === id) setSelectedSupplierId(null);
  }

  async function assign(ingredientId, supplierId) {
    try {
      await setIngredientSupplier(ingredientId, supplierId);
    } catch (err) {
      console.error(err);
      alert("Échec de l'attribution.");
    }
  }

  if (selectedSupplier) {
    const items = ingredients.filter((i) => i.supplierId === selectedSupplier.id).sort((a, b) => a.name.localeCompare(b.name));
    return (
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <button onClick={() => setSelectedSupplierId(null)} className="text-[#c9b8a4] text-sm font-semibold tap-scale mb-4">
          ← Fournisseurs
        </button>
        <div className="font-bold text-xl mb-5">🚚 {selectedSupplier.name}</div>
        <NewIngredientForm supplierId={selectedSupplier.id} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((ing) => (
            <div key={ing.id} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4 flex items-center justify-between gap-3">
              <span className="font-bold">{ing.name}</span>
              <button onClick={() => assign(ing.id, null)} className="tap-scale text-xs font-bold rounded-full px-3 py-2 border-2 border-[#3a2b1f]">
                ↩ Retirer
              </button>
            </div>
          ))}
          {items.length === 0 && <p className="text-[#8a7561]">Aucun ingrédient attribué à ce fournisseur pour l'instant.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="font-bold mb-3">Fournisseurs</div>
      <div className="flex flex-wrap gap-3 mb-4">
        {suppliers.map((s) => (
          <div key={s.id} className="flex items-center gap-1">
            <button
              onClick={() => setSelectedSupplierId(s.id)}
              className="tap-scale rounded-full px-5 py-3 font-bold border-2 border-[#3a2b1f]"
            >
              🚚 {s.name} <span className="text-[#a88f78]">({countBySupplier[s.id] || 0})</span>
            </button>
            {confirmingDeleteId === s.id ? (
              <button onClick={() => removeSupplier(s.id)} className="tap-scale text-xs font-bold rounded-full px-3 py-2" style={{ background: "#C0392B", color: "#fff5ea" }}>
                Confirmer ?
              </button>
            ) : (
              <button onClick={() => setConfirmingDeleteId(s.id)} className="tap-scale text-xs text-red-400 font-bold px-2">
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 mb-8">
        <input
          value={newSupplierName}
          onChange={(e) => setNewSupplierName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addSupplier()}
          placeholder="Nom du nouveau fournisseur"
          className="rounded-lg px-3 py-3 w-64"
          style={inputStyle}
        />
        <button onClick={addSupplier} className="tap-scale rounded-xl py-3 px-6 font-bold border-2 border-[#3a2b1f]">
          + Ajouter
        </button>
      </div>

      <div className="font-bold mb-1">Ingrédients à répartir ({unassigned.length})</div>
      <div className="text-xs text-[#8a7561] mb-4">Clique sur un fournisseur pour rattacher l'ingrédient — il disparaît ensuite de cette liste et rejoint sa page fournisseur.</div>
      <NewIngredientForm />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {unassigned
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((ing) => (
            <div key={ing.id} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
              <div className="font-bold mb-2">{ing.name}</div>
              {suppliers.length === 0 ? (
                <div className="text-xs text-[#8a7561]">Crée d'abord un fournisseur ci-dessus.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {suppliers.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => assign(ing.id, s.id)}
                      className="tap-scale text-xs font-bold rounded-full px-3 py-2 border-2 border-[#3a2b1f]"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        {unassigned.length === 0 && ingredients.length > 0 && <p className="text-[#8a7561]">Tous les ingrédients sont attribués.</p>}
        {ingredients.length === 0 && <p className="text-[#8a7561]">Aucun ingrédient enregistré — ajoutes-en dans l'onglet « Coût de revient ».</p>}
      </div>
    </div>
  );
}
