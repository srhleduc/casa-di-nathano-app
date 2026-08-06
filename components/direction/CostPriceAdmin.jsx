"use client";

import { useState } from "react";
import {
  useIngredients,
  insertIngredient,
  updateIngredient,
  deleteIngredient,
  usePizzaIngredients,
  setPizzaIngredient,
  removePizzaIngredient,
  useMenu,
} from "@/lib/data";
import { eur } from "@/lib/menu";

const UNITS = [
  { key: "g", label: "g" },
  { key: "kg", label: "kg" },
  { key: "ml", label: "ml" },
  { key: "l", label: "L" },
  { key: "piece", label: "pièce" },
];

const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };

function tabBtnClass(active) {
  return `tap-scale shrink-0 rounded-full px-5 py-2 font-bold border-2 text-sm ${active ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`;
}

function ingredientById(ingredients) {
  return Object.fromEntries(ingredients.map((i) => [i.id, i]));
}

function pizzaCost(pizzaId, pizzaIngredients, byId) {
  return pizzaIngredients
    .filter((pi) => pi.menuItemId === pizzaId)
    .reduce((sum, pi) => {
      const ing = byId[pi.ingredientId];
      return ing ? sum + pi.quantity * ing.costPerUnit : sum;
    }, 0);
}

export default function CostPriceAdmin() {
  const { ingredients } = useIngredients();
  const { pizzaIngredients } = usePizzaIngredients();
  const { menuItems } = useMenu();
  const pizzas = menuItems.filter((m) => m.cat === "pizza").sort((a, b) => a.name.localeCompare(b.name));
  const [tab, setTab] = useState("ingredients"); // "ingredients" | "recipes"

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="flex gap-3 mb-6">
        <button onClick={() => setTab("ingredients")} className={tabBtnClass(tab === "ingredients")}>
          🧂 Ingrédients
        </button>
        <button onClick={() => setTab("recipes")} className={tabBtnClass(tab === "recipes")}>
          🍕 Recettes & coûts
        </button>
      </div>
      {tab === "ingredients" && <IngredientsPanel ingredients={ingredients} />}
      {tab === "recipes" && (
        <RecipesPanel pizzas={pizzas} ingredients={ingredients} pizzaIngredients={pizzaIngredients} />
      )}
    </div>
  );
}

const EMPTY_INGREDIENT = { name: "", unit: "g", costPerUnit: "" };

function IngredientsPanel({ ingredients }) {
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_INGREDIENT);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

  function startEdit(ing) {
    setEditingId(ing.id);
    setForm({ name: ing.name, unit: ing.unit, costPerUnit: String(ing.costPerUnit) });
  }
  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_INGREDIENT);
  }

  async function save() {
    if (!form.name.trim() || form.costPerUnit === "") return;
    const payload = { name: form.name.trim(), unit: form.unit, costPerUnit: parseFloat(form.costPerUnit) || 0 };
    try {
      if (editingId) await updateIngredient(editingId, payload);
      else await insertIngredient(payload);
      cancelEdit();
    } catch (err) {
      console.error(err);
      alert("Échec de l'enregistrement de l'ingrédient.");
    }
  }

  function remove(id) {
    deleteIngredient(id).catch((err) => {
      console.error(err);
      alert("Impossible de supprimer : cet ingrédient est peut-être utilisé dans une recette.");
    });
    setConfirmingDeleteId(null);
    if (editingId === id) cancelEdit();
  }

  return (
    <div>
      <div className={`rounded-2xl border p-5 mb-8 ${editingId ? "border-[#C0392B]" : "border-[#3a2b1f]"}`}>
        <div className="font-bold mb-4">{editingId ? `Modifier « ${form.name} »` : "Ajouter un ingrédient"}</div>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Nom</div>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex. Mozzarella" className="rounded-lg px-3 py-3 w-56" style={inputStyle} />
          </div>
          <div>
            <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Unité</div>
            <div className="flex gap-2">
              {UNITS.map((u) => (
                <button
                  key={u.key}
                  onClick={() => setForm({ ...form, unit: u.key })}
                  className="tap-scale rounded-full px-3 py-2 text-sm font-bold border-2"
                  style={form.unit === u.key ? { borderColor: "#C0392B", background: "#2c1c14" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Coût par unité (€)</div>
            <input
              value={form.costPerUnit}
              onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })}
              type="number"
              step="0.0001"
              placeholder="Ex. 0.012"
              className="rounded-lg px-3 py-3 w-40"
              style={inputStyle}
            />
          </div>
          <button onClick={save} className="tap-scale rounded-xl py-3 px-6 font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
            {editingId ? "Enregistrer" : "Ajouter"}
          </button>
          {editingId && (
            <button onClick={cancelEdit} className="tap-scale rounded-xl py-3 px-5 font-bold border-2 border-[#3a2b1f]">
              Annuler
            </button>
          )}
        </div>
      </div>

      <div className="font-bold mb-3">Ingrédients ({ingredients.length})</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ingredients.map((ing) => (
          <div key={ing.id} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-bold truncate">{ing.name}</div>
              <div className="text-xs text-[#a88f78]">
                {eur(ing.costPerUnit)} / {UNITS.find((u) => u.key === ing.unit)?.label || ing.unit}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => startEdit(ing)} className="tap-scale text-xs font-bold rounded-full px-3 py-2 border-2 border-[#3a2b1f]">
                ✏️ Modifier
              </button>
              {confirmingDeleteId === ing.id ? (
                <button onClick={() => remove(ing.id)} className="tap-scale text-xs font-bold rounded-full px-3 py-2" style={{ background: "#C0392B", color: "#fff5ea" }}>
                  Confirmer ?
                </button>
              ) : (
                <button onClick={() => setConfirmingDeleteId(ing.id)} className="tap-scale text-xs text-red-400 font-bold">
                  Supprimer
                </button>
              )}
            </div>
          </div>
        ))}
        {ingredients.length === 0 && <p className="text-[#8a7561]">Aucun ingrédient enregistré pour l'instant.</p>}
      </div>
    </div>
  );
}

function RecipesPanel({ pizzas, ingredients, pizzaIngredients }) {
  const [selectedId, setSelectedId] = useState(pizzas[0]?.id || null);
  const byId = ingredientById(ingredients);
  const selectedPizza = pizzas.find((p) => p.id === selectedId);
  const recipe = pizzaIngredients.filter((pi) => pi.menuItemId === selectedId);
  const recipeByIngredient = Object.fromEntries(recipe.map((pi) => [pi.ingredientId, pi.quantity]));

  async function changeQty(ingredientId, value) {
    const qty = parseFloat(value);
    try {
      if (!value || isNaN(qty) || qty <= 0) {
        if (recipeByIngredient[ingredientId] !== undefined) await removePizzaIngredient(selectedId, ingredientId);
      } else {
        await setPizzaIngredient(selectedId, ingredientId, qty);
      }
    } catch (err) {
      console.error(err);
      alert("Échec de l'enregistrement de la recette.");
    }
  }

  return (
    <div>
      <div className="font-bold mb-3">Coût de revient par pizza</div>
      <div className="overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[#a88f78] uppercase">
              <th className="py-2 pr-4">Pizza</th>
              <th className="py-2 pr-4">Prix de vente</th>
              <th className="py-2 pr-4">Coût de revient</th>
              <th className="py-2 pr-4">Marge</th>
            </tr>
          </thead>
          <tbody>
            {pizzas.map((p) => {
              const cost = pizzaCost(p.id, pizzaIngredients, byId);
              const margin = p.price - cost;
              const marginPct = p.price > 0 ? (margin / p.price) * 100 : 0;
              return (
                <tr
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`tap-scale cursor-pointer border-t border-[#3a2b1f] ${selectedId === p.id ? "bg-[#2c1c14]" : ""}`}
                >
                  <td className="py-2 pr-4 font-bold">{p.name}</td>
                  <td className="py-2 pr-4">{eur(p.price)}</td>
                  <td className="py-2 pr-4">{eur(cost)}</td>
                  <td className="py-2 pr-4" style={{ color: marginPct < 60 ? "#e88a8a" : "#a8e8c8" }}>
                    {eur(margin)} ({marginPct.toFixed(0)}%)
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pizzas.length === 0 && <p className="text-[#8a7561] mt-3">Aucune pizza dans le menu.</p>}
      </div>

      {selectedPizza && (
        <div className="rounded-2xl border border-[#3a2b1f] p-5">
          <div className="font-bold mb-4">Recette « {selectedPizza.name} »</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ingredients.map((ing) => (
              <div key={ing.id} className="flex items-center justify-between gap-3">
                <span className="text-sm">{ing.name}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    defaultValue={recipeByIngredient[ing.id] ?? ""}
                    key={`${selectedId}-${ing.id}`}
                    onBlur={(e) => changeQty(ing.id, e.target.value)}
                    placeholder="0"
                    className="w-24 rounded-lg px-3 py-2 text-sm text-right"
                    style={inputStyle}
                  />
                  <span className="text-xs text-[#a88f78] w-12">{UNITS.find((u) => u.key === ing.unit)?.label || ing.unit}</span>
                </div>
              </div>
            ))}
            {ingredients.length === 0 && <p className="text-[#8a7561]">Ajoute d'abord des ingrédients dans l'onglet « Ingrédients ».</p>}
          </div>
        </div>
      )}
    </div>
  );
}
