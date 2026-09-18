"use client";

import { useEffect, useState } from "react";
import { useOrders, usePizzaStock, setPizzaStock } from "@/lib/data";
import { remainingPizzaStock, isOrderActiveToday } from "@/lib/business";

const inputStyle = { background: "var(--color-bg-team)", border: "1px solid var(--color-border)", color: "var(--color-text)" };

export default function PizzaStockAdmin() {
  const { orders } = useOrders();
  const { pizzaStock, loading } = usePizzaStock();
  const [totalInput, setTotalInput] = useState("");
  const [marginInput, setMarginInput] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [saved, setSaved] = useState(false);

  // Le stock arrive de façon asynchrone : on ne pré-remplit les champs
  // qu'une fois le premier chargement terminé.
  useEffect(() => {
    if (!loading && !initialized) {
      setTotalInput(pizzaStock.total ? String(pizzaStock.total) : "");
      setMarginInput(pizzaStock.safetyMargin ? String(pizzaStock.safetyMargin) : "");
      setInitialized(true);
    }
  }, [loading, initialized, pizzaStock]);

  function save() {
    const total = parseInt(totalInput, 10);
    const safetyMargin = parseInt(marginInput, 10);
    setPizzaStock({ total: isNaN(total) ? 0 : total, safetyMargin: isNaN(safetyMargin) ? 0 : safetyMargin })
      .then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      })
      .catch((err) => console.error(err));
  }

  const used = orders.filter(isOrderActiveToday).reduce((s, o) => s + (o.pizzaCount || 0), 0);
  const remaining = remainingPizzaStock(orders, pizzaStock);
  const isLimited = (pizzaStock.total || 0) > 0;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <p className="mb-6 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Laisse "Pâtons disponibles" vide (ou à 0) les soirs normaux — les pizzas restent illimitées. Renseigne-le
        uniquement les soirs où le stock de pâtons est compté : dès que le nombre utilisable (pâtons moins marge de
        sécurité moins pizzas déjà commandées) tombe à 0, les pizzas disparaissent automatiquement du menu côté
        borne et équipe.
      </p>

      <div className="rounded-xl border p-5 max-w-md mb-6" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-card)" }}>
        <div className="mb-4">
          <div className="text-xs uppercase font-bold mb-1" style={{ color: "var(--color-text-muted)" }}>Pâtons disponibles ce soir</div>
          <input value={totalInput} onChange={(e) => setTotalInput(e.target.value)} type="number" placeholder="Illimité" className="rounded-lg px-3 py-3 w-32" style={inputStyle} />
        </div>
        <div className="mb-4">
          <div className="text-xs uppercase font-bold mb-1" style={{ color: "var(--color-text-muted)" }}>Marge de sécurité (pizzas ratées prévues)</div>
          <input value={marginInput} onChange={(e) => setMarginInput(e.target.value)} type="number" placeholder="0" className="rounded-lg px-3 py-3 w-32" style={inputStyle} />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={save} className="tap-scale rounded-lg px-4 py-3 font-bold text-sm" style={{ background: "var(--color-accent)", color: "var(--color-text-alt)" }}>
            Enregistrer
          </button>
          {saved && <span className="text-sm font-bold" style={{ color: "var(--color-accent-gold)" }}>✓ Enregistré</span>}
        </div>
      </div>

      <div className="rounded-xl border p-5 max-w-md" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-card)" }}>
        <div className="text-xs uppercase font-bold mb-1" style={{ color: "var(--color-text-muted)" }}>Stock utilisable ce soir</div>
        {isLimited ? (
          <>
            <div className="text-3xl font-bold display-font" style={{ color: remaining <= 0 ? "var(--color-accent)" : "var(--color-accent-gold)" }}>
              {remaining <= 0 ? "🚫 Épuisé" : `${remaining} pizza${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""}`}
            </div>
            <div className="text-xs mt-2" style={{ color: "var(--color-text-faint)" }}>
              {used} pizza{used > 1 ? "s" : ""} déjà commandée{used > 1 ? "s" : ""} aujourd'hui · marge de {pizzaStock.safetyMargin || 0} réservée
            </div>
          </>
        ) : (
          <div className="text-lg font-bold" style={{ color: "var(--color-text-subtle)" }}>Illimité (aucun stock configuré)</div>
        )}
      </div>
    </div>
  );
}
