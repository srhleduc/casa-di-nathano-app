"use client";

import { useState } from "react";
import { eur } from "@/lib/menu";

const FEATURED_NAMES = ["Supplément Anchois", "Supplément Cœur de Burrata", "Supplément Mozzarella di Buffala", "Supplément Salade"];
// Mis en avant en plus des suppléments génériques ci-dessus, uniquement
// pour certaines pizzas où ils sont particulièrement pertinents.
const EXTRA_FEATURED_BY_PIZZA = {
  "4 Formaggi": ["Supplément base tomate", "Supplément base crème"],
};

export default function PizzaCustomizeModal({ pizza, menu, onClose, onConfirm, staffMode }) {
  const [mode, setMode] = useState("detail"); // detail | remove | add
  const [removedNames, setRemovedNames] = useState([]); // noms d'ingrédients (sans préfixe)
  const [addedIds, setAddedIds] = useState([]); // ids d'articles Supp. sélectionnés
  const [showOtherSupp, setShowOtherSupp] = useState(false);
  const [itemNote, setItemNote] = useState(""); // note libre serveuse pour cette pizza

  const recipe = pizza.ingredients || [];
  const allSupplements = (menu || []).filter((m) => m.cat === "supplement");
  const featuredNames = [...FEATURED_NAMES, ...(EXTRA_FEATURED_BY_PIZZA[pizza.name] || [])];
  const featuredSupplements = featuredNames.map((n) => allSupplements.find((s) => s.name === n)).filter(Boolean);
  const otherSupplements = allSupplements.filter((s) => !featuredNames.includes(s.name));

  function toggleRemoved(name) {
    setRemovedNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }
  function toggleAdded(id) {
    setAddedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  function confirm() {
    const removedItems = removedNames.map((n) => (menu || []).find((m) => m.cat === "sans" && m.name === `Sans ${n}`)).filter(Boolean);
    const addedItems = addedIds.map((id) => (menu || []).find((m) => m.id === id)).filter(Boolean);
    onConfirm(removedItems, addedItems, itemNote.trim() || null);
  }

  const extraCount = removedNames.length + addedIds.length;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70">
      <div className="pizza-modal w-full md:max-w-2xl md:rounded-3xl overflow-hidden flex flex-col" style={{ background: "var(--color-bg)", color: "var(--color-text)", height: "min(92vh, 720px)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
          <span className="display-font text-2xl font-bold">{pizza.name}</span>
          <button onClick={onClose} className="tap-scale w-9 h-9 rounded-full font-bold" style={{ background: "var(--color-surface)", color: "var(--color-text-subtle)" }}>
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {mode === "detail" && (
            <>
              <div className="display-font italic text-2xl mb-4" style={{ color: "var(--color-accent-gold)" }}>{eur(pizza.price)}</div>
              {recipe.length > 0 && (
                <>
                  <div className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: "var(--color-text-muted)" }}>Ingrédients</div>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {recipe.map((n) => (
                      <span key={n} className="chip text-sm" style={{ color: "var(--color-text-subtle)" }}>
                        {n}
                      </span>
                    ))}
                  </div>
                </>
              )}
              {recipe.length > 0 && (
                <button onClick={() => setMode("remove")} className="tap-scale w-full rounded-xl py-4 font-bold border-2 mb-4" style={{ borderColor: "var(--color-border)" }}>
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
                  className="tap-scale flex-1 rounded-xl py-3 font-bold border-2"
                  style={{ borderColor: mode === "remove" ? "var(--color-accent)" : "var(--color-border)", background: mode === "remove" ? "var(--color-surface-alt)" : undefined }}
                >
                  ➖ Retirer un ingrédient
                </button>
                <button
                  onClick={() => setMode("add")}
                  className="tap-scale flex-1 rounded-xl py-3 font-bold border-2"
                  style={{ borderColor: mode === "add" ? "var(--color-accent)" : "var(--color-border)", background: mode === "add" ? "var(--color-surface-alt)" : undefined }}
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
                        style={isOff ? { background: "var(--color-accent)", borderColor: "var(--color-accent)", color: "var(--color-text-alt)" } : { color: "var(--color-text-subtle)" }}
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
                          style={isOn ? { background: "var(--color-accent)", borderColor: "var(--color-accent)", color: "var(--color-text-alt)" } : { color: "var(--color-text-subtle)" }}
                        >
                          {isOn ? "✓ " : "+ "}
                          {s.name.replace("Supplément ", "")} {s.price > 0 ? `(${eur(s.price)})` : ""}
                        </button>
                      );
                    })}
                  </div>

                  {!showOtherSupp && (
                    <button onClick={() => setShowOtherSupp(true)} className="tap-scale mt-4 font-semibold underline underline-offset-4" style={{ color: "var(--color-text-subtle)" }}>
                      Autres suppléments…
                    </button>
                  )}

                  {showOtherSupp && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t" style={{ borderColor: "var(--color-border)" }}>
                      {otherSupplements.map((s) => {
                        const isOn = addedIds.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            onClick={() => toggleAdded(s.id)}
                            className="chip tap-scale"
                            style={isOn ? { background: "var(--color-accent)", borderColor: "var(--color-accent)", color: "var(--color-text-alt)" } : { color: "var(--color-text-subtle)" }}
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

          {staffMode && (
            <div className={mode === "detail" ? "" : "mt-6 pt-5 border-t"} style={mode === "detail" ? undefined : { borderColor: "var(--color-border)" }}>
              <div className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: "var(--color-warning)" }}>
                📝 Note pour ce produit (facultatif)
              </div>
              <textarea
                value={itemNote}
                onChange={(e) => setItemNote(e.target.value)}
                placeholder="Ex. bien cuite, sans sel, à part…"
                rows={2}
                className="w-full rounded-xl px-4 py-3 text-base outline-none resize-none"
                style={{ background: "var(--color-surface-card)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              />
            </div>
          )}
        </div>

        <div className="px-6 py-5 border-t" style={{ borderColor: "var(--color-border)" }}>
          <button onClick={confirm} className="tap-scale w-full rounded-full py-5 text-xl font-bold" style={{ background: "var(--color-accent)", color: "var(--color-text-alt)" }}>
            Ajouter au panier{extraCount > 0 ? ` (${extraCount} modif.)` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
