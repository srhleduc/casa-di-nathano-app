"use client";

import { useEffect, useState } from "react";
import { useOrders, useDessertStock, setDessertStockQty } from "@/lib/data";
import { DESSERT_STOCK_GROUPS } from "@/lib/menu";
import { remainingForDessertGroup } from "@/lib/business";

export default function DessertStockAdmin() {
  const { orders } = useOrders();
  const { dessertStock, loading } = useDessertStock();
  const [inputs, setInputs] = useState({});
  const [initialized, setInitialized] = useState(false);

  // Le stock arrive de façon asynchrone (Supabase) : on ne pré-remplit les
  // champs qu'une fois le premier chargement terminé, pour ne pas écraser
  // ce que l'équipe est en train de taper.
  useEffect(() => {
    if (!loading && !initialized) {
      setInputs(Object.fromEntries(DESSERT_STOCK_GROUPS.map((g) => [g.key, String(dessertStock[g.key] ?? "")])));
      setInitialized(true);
    }
  }, [loading, initialized, dessertStock]);

  function save(key) {
    const n = parseInt(inputs[key], 10);
    setDessertStockQty(key, isNaN(n) ? 0 : n).catch((err) => console.error(err));
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <p className="text-[#a88f78] mb-6 text-sm">
        Renseigne chaque matin le nombre préparé. Dès que le stock est épuisé, le dessert disparaît automatiquement du menu — la borne et l'équipe décomptent en direct au fil des commandes.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DESSERT_STOCK_GROUPS.map((g) => {
          const remaining = remainingForDessertGroup(orders, dessertStock, g);
          return (
            <div key={g.key} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
              <div className="font-bold mb-1">{g.label}</div>
              {g.itemNames.length > 1 && <div className="text-xs text-[#8a7561] mb-3">Stock partagé : {g.itemNames.join(" + ")}</div>}
              <div className="flex items-center gap-3 mb-2">
                <input
                  value={inputs[g.key] ?? ""}
                  onChange={(e) => setInputs({ ...inputs, [g.key]: e.target.value })}
                  type="number"
                  placeholder="Quantité faite"
                  className="rounded-lg px-3 py-2 w-32"
                  style={{ background: "#140d08", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
                />
                <button onClick={() => save(g.key)} className="tap-scale rounded-lg px-4 py-2 font-bold text-sm" style={{ background: "#C0392B", color: "#fff5ea" }}>
                  Enregistrer
                </button>
              </div>
              <div className={`text-sm font-bold ${remaining <= 0 ? "text-[#C0392B]" : "text-[#E8B23D]"}`}>
                {remaining <= 0 ? "🚫 Épuisé" : `${remaining} restant${remaining > 1 ? "s" : ""} aujourd'hui`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
