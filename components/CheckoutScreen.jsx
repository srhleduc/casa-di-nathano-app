"use client";

import { eur, flavorConfigFor } from "@/lib/menu";
import { lineUnitPrice } from "@/lib/business";

const OPTIONS = ["🍽️ Sur place", "🥡 À emporter"];

export default function CheckoutScreen({ cart, changeQty, total, pizzaCount, serviceType, setServiceType, tableName, setTableName, onBack, onConfirm }) {
  return (
    <div className="flex-1 flex flex-col px-6 py-6 overflow-y-auto">
      <button onClick={onBack} className="text-[#c9b8a4] text-sm font-semibold mb-6 self-start tap-scale">
        ← Continuer mes achats
      </button>
      <h2 className="display-font text-3xl font-semibold mb-6">Ma commande</h2>

      <div className="flex-1 flex flex-col gap-3 mb-6">
        {cart.map((i) => (
          <div
            key={i.id + "-" + (i.note || "") + "-" + (i.modifiers || []).map((m) => m.name).join(",")}
            className="flex items-center justify-between rounded-xl border border-[#3a2b1f] bg-[#211712] px-4 py-3"
          >
            <div>
              <div className="font-bold">{i.name}</div>
              {i.note && (
                <div className="text-xs text-[#E8B23D] pl-3">
                  ↳ {flavorConfigFor(i.name)?.icon || "🍨"} {i.note}
                </div>
              )}
              {(i.modifiers || []).map((m, mi) => (
                <div key={mi} className="text-xs text-[#a88f78] pl-3">
                  ↳ {m.name}
                  {m.price > 0 ? ` (+${eur(m.price)})` : ""}
                </div>
              ))}
              <div className="text-[#a88f78] text-sm mt-1">{eur(lineUnitPrice(i))} / unité</div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => changeQty(i.id, i.note, i.modifiers, -1)} className="tap-scale w-9 h-9 rounded-full bg-[#3a2b1f] text-xl font-bold">
                −
              </button>
              <span className="w-6 text-center font-bold">{i.qty}</span>
              <button onClick={() => changeQty(i.id, i.note, i.modifiers, 1)} className="tap-scale w-9 h-9 rounded-full bg-[#3a2b1f] text-xl font-bold">
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <div className="text-sm font-bold text-[#a88f78] uppercase tracking-wide mb-2">Type de commande</div>
        <div className="flex gap-3">
          {OPTIONS.map((opt) => {
            const isSelected = serviceType === opt;
            return (
              <button
                key={opt}
                onClick={() => setServiceType(opt)}
                className="tap-scale flex-1 rounded-xl py-4 font-bold border-2 flex items-center justify-center gap-2"
                style={isSelected ? { background: "#C0392B", borderColor: "#C0392B", color: "#fff5ea" } : { background: "#211712", borderColor: "#3a2b1f", color: "#a88f78" }}
              >
                {isSelected && <span>✓</span>}
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-8">
        <div className="text-sm font-bold text-[#a88f78] uppercase tracking-wide mb-2">
          {serviceType === "🍽️ Sur place" ? "Numéro de table" : "Ton nom (pour t'appeler)"}
        </div>
        <input
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          placeholder={serviceType === "🍽️ Sur place" ? "Ex. 12" : "Ex. Julie"}
          className="w-full rounded-xl px-4 py-4 text-lg outline-none"
          style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
        />
      </div>

      <div className="flex items-center justify-between mb-4">
        <span className="text-xl font-bold">Total</span>
        <span className="display-font text-3xl font-bold text-[#E8B23D]">{eur(total)}</span>
      </div>
      <button onClick={onConfirm} disabled={cart.length === 0} className="tap-scale rounded-full py-6 text-2xl font-bold disabled:opacity-40" style={{ background: "#C0392B", color: "#fff5ea" }}>
        {pizzaCount > 0 ? "Choisir mon créneau →" : "Valider ma commande →"}
      </button>
      <p className="text-center text-[#8a7561] text-sm mt-4">Le règlement se fait en caisse, après validation.</p>
    </div>
  );
}
