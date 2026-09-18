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
      <p className="mb-6 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Renseigne chaque matin le nombre préparé. Dès que le stock est épuisé, le dessert disparaît automatiquement du menu — la borne et l'équipe décomptent en direct au fil des commandes.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DESSERT_STOCK_GROUPS.map((g) => {
          const remaining = remainingForDessertGroup(orders, dessertStock, g);
          return (
            <div key={g.key} className="rounded-xl border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-card)" }}>
              <div className="font-bold mb-1">{g.label}</div>
              {g.itemNames.length > 1 && <div className="text-xs mb-3" style={{ color: "var(--color-text-faint)" }}>Stock partagé : {g.itemNames.join(" + ")}</div>}
              <div className="flex items-center gap-3 mb-2">
                <input
                  value={inputs[g.key] ?? ""}
                  onChange={(e) => setInputs({ ...inputs, [g.key]: e.target.value })}
                  type="number"
                  placeholder="Quantité faite"
                  className="rounded-lg px-3 py-2 w-32"
                  style={{ background: "var(--color-bg-team)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                />
                <button onClick={() => save(g.key)} className="tap-scale rounded-lg px-4 py-2 font-bold text-sm" style={{ background: "var(--color-accent)", color: "var(--color-text-alt)" }}>
                  Enregistrer
                </button>
              </div>
              {g.unlimited ? (
                <div className="text-sm font-bold" style={{ color: "var(--color-success-strong)" }}>
                  ✅ Toujours disponible — décompte désactivé (en attendant l'API caisse)
                </div>
              ) : (
                <>
                  <div className="text-sm font-bold" style={{ color: remaining <= 0 ? "var(--color-accent)" : "var(--color-accent-gold)" }}>
                    {remaining <= 0 ? "🚫 Épuisé" : `${remaining} restant${remaining > 1 ? "s" : ""} aujourd'hui`}
                  </div>
                  {g.unlimitedStaffOnly && (
                    <div className="text-xs mt-0.5" style={{ color: "var(--color-text-faint)" }}>
                      Illimité côté serveuses — ce décompte ne concerne que la borne / le click &amp; collect.
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
