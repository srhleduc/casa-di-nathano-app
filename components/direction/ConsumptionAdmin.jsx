"use client";

import { useEffect, useState } from "react";
import { useIngredients, usePizzaIngredients, fetchDailySales, fetchConsumptionActuals, setConsumptionActual } from "@/lib/data";
import { useRestaurantsList } from "@/lib/restaurant";

const UNIT_LABELS = { g: "g", kg: "kg", ml: "ml", l: "L", piece: "pièce" };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };

export default function ConsumptionAdmin() {
  const restaurants = useRestaurantsList();
  const { ingredients } = useIngredients();
  const { pizzaIngredients } = usePizzaIngredients();

  const [restaurantId, setRestaurantId] = useState(null);
  const [start, setStart] = useState(daysAgoStr(6));
  const [end, setEnd] = useState(todayStr());
  const [sales, setSales] = useState([]);
  const [actuals, setActuals] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!restaurantId && restaurants.length > 0) setRestaurantId(restaurants[0].id);
  }, [restaurants, restaurantId]);

  useEffect(() => {
    if (!restaurantId || !start || !end) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchDailySales(restaurantId, start, end), fetchConsumptionActuals(restaurantId, start, end)])
      .then(([salesRows, actualRows]) => {
        if (cancelled) return;
        setSales(salesRows);
        setActuals(Object.fromEntries(actualRows.map((a) => [a.ingredient_id, a.qty_actual])));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [restaurantId, start, end]);

  // Quantité théorique par pizza vendue sur la période.
  const soldByPizza = {};
  for (const row of sales) {
    soldByPizza[row.menu_item_id] = (soldByPizza[row.menu_item_id] || 0) + row.qty;
  }

  const theoreticalByIngredient = {};
  for (const pi of pizzaIngredients) {
    const sold = soldByPizza[pi.menuItemId];
    if (!sold) continue;
    theoreticalByIngredient[pi.ingredientId] = (theoreticalByIngredient[pi.ingredientId] || 0) + sold * pi.quantity;
  }

  const relevantIngredients = ingredients.filter((ing) => theoreticalByIngredient[ing.id] !== undefined || actuals[ing.id] !== undefined);

  async function saveActual(ingredientId, value) {
    const qty = parseFloat(value);
    if (value === "" || isNaN(qty)) return;
    try {
      await setConsumptionActual(restaurantId, ingredientId, start, end, qty);
      setActuals((prev) => ({ ...prev, [ingredientId]: qty }));
    } catch (err) {
      console.error(err);
      alert("Échec de l'enregistrement.");
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Restaurant</div>
          <div className="flex gap-2">
            {restaurants.map((r) => (
              <button
                key={r.id}
                onClick={() => setRestaurantId(r.id)}
                className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2"
                style={restaurantId === r.id ? { borderColor: "#C0392B", background: "#2c1c14" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Du</div>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
        </div>
        <div>
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Au</div>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
        </div>
      </div>

      <div className="text-xs text-[#8a7561] mb-4">
        Théorique = quantité qui aurait dû être utilisée d'après les ventes de pizzas de la période et les recettes définies dans « Coût de
        revient ». Seul le jour d'hier et les jours précédents sont pris en compte (les ventes du jour même ne sont archivées qu'à 4h du matin).
      </div>

      {loading && <p className="text-[#8a7561]">Chargement…</p>}

      {!loading && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#a88f78] uppercase">
                <th className="py-2 pr-4">Ingrédient</th>
                <th className="py-2 pr-4">Théorique</th>
                <th className="py-2 pr-4">Réel (saisie)</th>
                <th className="py-2 pr-4">Écart</th>
              </tr>
            </thead>
            <tbody>
              {relevantIngredients.map((ing) => {
                const theoretical = theoreticalByIngredient[ing.id] || 0;
                const actual = actuals[ing.id];
                const unit = UNIT_LABELS[ing.unit] || ing.unit;
                const diff = actual !== undefined ? actual - theoretical : null;
                const diffPct = actual !== undefined && theoretical > 0 ? (diff / theoretical) * 100 : null;
                return (
                  <tr key={ing.id} className="border-t border-[#3a2b1f]">
                    <td className="py-2 pr-4 font-bold">{ing.name}</td>
                    <td className="py-2 pr-4">
                      {theoretical.toFixed(2)} {unit}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          defaultValue={actual ?? ""}
                          key={`${restaurantId}-${start}-${end}-${ing.id}`}
                          onBlur={(e) => saveActual(ing.id, e.target.value)}
                          placeholder="—"
                          className="w-24 rounded-lg px-3 py-2 text-sm text-right"
                          style={inputStyle}
                        />
                        <span className="text-xs text-[#a88f78]">{unit}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4" style={diff === null ? undefined : { color: diff > 0 ? "#e88a8a" : "#a8e8c8" }}>
                      {diff === null ? "—" : `${diff > 0 ? "+" : ""}${diff.toFixed(2)} ${unit}${diffPct !== null ? ` (${diffPct > 0 ? "+" : ""}${diffPct.toFixed(0)}%)` : ""}`}
                    </td>
                  </tr>
                );
              })}
              {relevantIngredients.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-[#8a7561]">
                    Aucune vente de pizza archivée sur cette période pour ce restaurant, ou aucune recette définie.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
