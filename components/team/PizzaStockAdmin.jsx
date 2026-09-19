"use client";

import { useEffect, useState } from "react";
import { useOrders, usePizzaStock, setPizzaStock } from "@/lib/data";
import { remainingPizzaStock, isOrderActiveToday } from "@/lib/business";

const inputStyle = { background: "#140d08", border: "1px solid #3a2b1f", color: "#f5ebdd" };

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
      <p className="text-[#a88f78] mb-6 text-sm">
        Laisse "Pâtons disponibles" vide (ou à 0) les soirs normaux — les pizzas restent illimitées. Renseigne-le
        uniquement les soirs où le stock de pâtons est compté : dès que le nombre utilisable (pâtons moins marge de
        sécurité moins pizzas déjà commandées) tombe à 0, les pizzas disparaissent automatiquement du menu côté
        borne et équipe.
      </p>

      <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-5 max-w-md mb-6">
        <div className="mb-4">
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Pâtons disponibles ce soir</div>
          <input value={totalInput} onChange={(e) => setTotalInput(e.target.value)} type="number" placeholder="Illimité" className="rounded-lg px-3 py-3 w-32" style={inputStyle} />
        </div>
        <div className="mb-4">
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Marge de sécurité (pizzas ratées prévues)</div>
          <input value={marginInput} onChange={(e) => setMarginInput(e.target.value)} type="number" placeholder="0" className="rounded-lg px-3 py-3 w-32" style={inputStyle} />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={save} className="tap-scale rounded-lg px-4 py-3 font-bold text-sm" style={{ background: "#C0392B", color: "#fff5ea" }}>
            Enregistrer
          </button>
          {saved && <span className="text-sm text-[#E8B23D] font-bold">✓ Enregistré</span>}
        </div>
      </div>

      <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-5 max-w-md">
        <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Stock utilisable ce soir</div>
        {isLimited ? (
          <>
            <div className={`text-3xl font-bold display-font ${remaining <= 0 ? "text-[#C0392B]" : "text-[#E8B23D]"}`}>
              {remaining <= 0 ? "🚫 Épuisé" : `${remaining} pizza${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""}`}
            </div>
            <div className="text-xs text-[#8a7561] mt-2">
              {used} pizza{used > 1 ? "s" : ""} déjà commandée{used > 1 ? "s" : ""} aujourd'hui · marge de {pizzaStock.safetyMargin || 0} réservée
            </div>
          </>
        ) : (
          <div className="text-lg font-bold text-[#c9b8a4]">Illimité (aucun stock configuré)</div>
        )}
      </div>
    </div>
  );
}
