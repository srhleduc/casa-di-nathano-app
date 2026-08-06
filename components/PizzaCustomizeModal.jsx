"use client";

import { useState } from "react";
import { eur } from "@/lib/menu";

const FEATURED_NAMES = ["Supplément Anchois", "Supplément Cœur de Burrata", "Supplément Mozzarella di Buffala", "Supplément Salade"];

export default function PizzaCustomizeModal({ pizza, menu, onClose, onConfirm }) {
  const [mode, setMode] = useState("detail"); // detail | remove | add
  const [removedNames, setRemovedNames] = useState([]); // noms d'ingrédients (sans préfixe)
  const [addedIds, setAddedIds] = useState([]); // ids d'articles Supp. sélectionnés
  const [showOtherSupp, setShowOtherSupp] = useState(false);

  const recipe = pizza.ingredients || [];
  const allSupplements = (menu || []).filter((m) => m.cat === "supplement");
  const featuredSupplements = FEATURED_NAMES.map((n) => allSupplements.find((s) => s.name === n)).filter(Boolean);
  const otherSupplements = allSupplements.filter((s) => !FEATURED_NAMES.includes(s.name));

  function toggleRemoved(name) {
    setRemovedNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }
  function toggleAdded(id) {
    setAddedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  function confirm() {
    const removedItems = removedNames.map((n) => (menu || []).find((m) => m.cat === "sans" && m.name === `Sans ${n}`)).filter(Boolean);
    const addedItems = addedIds.map((id) => (menu || []).find((m) => m.id === id)).filter(Boolean);
    onConfirm(removedItems, addedItems);
  }

  const extraCount = removedNames.length + addedIds.length;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70">
      <div className="pizza-modal w-full md:max-w-2xl md:rounded-3xl overflow-hidden flex flex-col" style={{ background: "#1a120b", color: "#f5ebdd", height: "min(92vh, 720px)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a2b1f]">
          <span className="display-font text-2xl font-bold">{pizza.name}</span>
          <button onClick={onClose} className="tap-scale w-9 h-9 rounded-full bg-[#241811] text-[#c9b8a4] font-bold">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {mode === "detail" && (
            <>
              <div className="display-font italic text-2xl text-[#E8B23D] mb-4">{eur(pizza.price)}</div>
              {recipe.length > 0 && (
                <>
                  <div className="text-sm font-bold text-[#a88f78] uppercase tracking-wide mb-2">Ingrédients</div>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {recipe.map((n) => (
                      <span key={n} className="chip text-sm text-[#c9b8a4]">
                        {n}
                      </span>
                    ))}
                  </div>
                </>
              )}
              {recipe.length > 0 && (
                <button onClick={() => setMode("remove")} className="tap-scale w-full rounded-xl py-4 font-bold border-2 border-[#3a2b1f] mb-3">
                  🎛️ Personnaliser cette pizza
                </button>
              )}
            </>
          )}

          {(mode === "remove" || mode === "add") && (
            <>
              <div className="flex gap-3 mb-5">
                <button
                  onClick={() => setMode("remove")}
                  className={`tap-scale flex-1 rounded-xl py-3 font-bold border-2 ${mode === "remove" ? "border-[#C0392B]" : "border-[#3a2b1f]"}`}
                  style={mode === "remove" ? { background: "#2c1c14" } : {}}
                >
                  ➖ Retirer un ingrédient
                </button>
                <button
                  onClick={() => setMode("add")}
                  className={`tap-scale flex-1 rounded-xl py-3 font-bold border-2 ${mode === "add" ? "border-[#C0392B]" : "border-[#3a2b1f]"}`}
                  style={mode === "add" ? { background: "#2c1c14" } : {}}
                >
                  ➕ Ajouter un supplément
                </button>
              </div>

              {mode === "remove" && (
                <div className="flex flex-wrap gap-2">
                  {recipe.map((n) => {
                    const isOff = removedNames.includes(n);
                    return (
                      <button
                        key={n}
                        onClick={() => toggleRemoved(n)}
                        className="chip tap-scale"
                        style={isOff ? { background: "#C0392B", borderColor: "#C0392B", color: "#fff5ea" } : { color: "#c9b8a4" }}
                      >
                        {isOff ? "✕ Sans " : ""}
                        {n}
                      </button>
                    );
                  })}
                </div>
              )}

              {mode === "add" && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {featuredSupplements.map((s) => {
                      const isOn = addedIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleAdded(s.id)}
                          className="chip tap-scale"
                          style={isOn ? { background: "#C0392B", borderColor: "#C0392B", color: "#fff5ea" } : { color: "#c9b8a4" }}
                        >
                          {isOn ? "✓ " : "+ "}
                          {s.name.replace("Supplément ", "")} {s.price > 0 ? `(${eur(s.price)})` : ""}
                        </button>
                      );
                    })}
                  </div>

                  {!showOtherSupp && (
                    <button onClick={() => setShowOtherSupp(true)} className="tap-scale mt-4 text-[#c9b8a4] font-semibold underline underline-offset-4">
                      Autres suppléments…
                    </button>
                  )}

                  {showOtherSupp && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#3a2b1f]">
                      {otherSupplements.map((s) => {
                        const isOn = addedIds.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            onClick={() => toggleAdded(s.id)}
                            className="chip tap-scale"
                            style={isOn ? { background: "#C0392B", borderColor: "#C0392B", color: "#fff5ea" } : { color: "#c9b8a4" }}
                          >
                            {isOn ? "✓ " : "+ "}
                            {s.name} {s.price > 0 ? `(${eur(s.price)})` : ""}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-5 border-t border-[#3a2b1f]">
          <button onClick={confirm} className="tap-scale w-full rounded-full py-5 text-xl font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
            Ajouter au panier{extraCount > 0 ? ` (${extraCount} modif.)` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
