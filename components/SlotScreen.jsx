"use client";

import { useEffect, useState } from "react";

// Un "créneau réparti" (grosse commande sur plusieurs créneaux consécutifs)
// est affiché exactement comme un créneau simple — seul le dernier horaire
// de la série est montré au client, la répartition réelle (qui remplit
// entièrement les créneaux précédents) reste un détail d'implémentation.
export default function SlotScreen({ pizzaCount, slotChoice, selectedOption, setSelectedOption, allSlotsConfigured, onBack, onConfirm }) {
  const [showAll, setShowAll] = useState(false);
  const mode = slotChoice?.mode;

  const displayOptions =
    mode === "single"
      ? (slotChoice.options || []).map((s) => ({
          key: s.id,
          label: s.label,
          remaining: s.remaining,
          plan: [{ slotId: s.id, label: s.label, qty: pizzaCount }],
        }))
      : mode === "split"
      ? (slotChoice.plans || []).map((p, i) => ({
          key: `plan-${i}`,
          label: p[p.length - 1].label,
          remaining: null,
          plan: p,
        }))
      : [];

  useEffect(() => {
    if (displayOptions.length > 0 && !selectedOption) {
      setSelectedOption(displayOptions[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotChoice]);

  const earliest = displayOptions[0];
  const laterOptions = displayOptions.slice(1);

  return (
    <div className="flex-1 flex flex-col px-6 py-6">
      <button onClick={onBack} className="text-[#c9b8a4] text-sm font-semibold mb-6 self-start tap-scale">
        ← Retour
      </button>
      <h2 className="display-font text-3xl font-semibold mb-2">Ton créneau</h2>
      <p className="text-[#a88f78] mb-8">
        {pizzaCount} pizza{pizzaCount > 1 ? "s" : ""} dans ta commande — on t'affiche uniquement les horaires où le four a la place.
      </p>

      {!allSlotsConfigured && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <span className="text-5xl mb-4">🧑‍🍳</span>
          <p className="text-[#c9b8a4]">L'équipe n'a pas encore ouvert les créneaux du service.</p>
          <p className="text-[#8a7561] text-sm mt-2">Adresse-toi directement à un membre de l'équipe.</p>
        </div>
      )}

      {allSlotsConfigured && mode === "none" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <span className="text-5xl mb-4">😕</span>
          <p className="text-[#c9b8a4]">
            Même en répartissant sur plusieurs créneaux, le four n'a pas la place pour {pizzaCount} pizza{pizzaCount > 1 ? "s" : ""} aujourd'hui.
          </p>
          <p className="text-[#8a7561] text-sm mt-2">Réduis le nombre de pizzas, ou adresse-toi directement à l'équipe.</p>
        </div>
      )}

      {allSlotsConfigured && earliest && !showAll && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <span className="text-sm font-bold uppercase tracking-wide text-[#a88f78] mb-3">Créneau le plus proche</span>
          <div className="rounded-3xl border-2 border-[#C0392B] bg-[#2c1c14] px-14 py-10 mb-6">
            <div className="display-font text-6xl font-bold">{earliest.label}</div>
            {earliest.remaining != null && (
              <div className="text-[#a88f78] mt-2">
                {earliest.remaining} place{earliest.remaining > 1 ? "s" : ""} disponible{earliest.remaining > 1 ? "s" : ""}
              </div>
            )}
          </div>
          {laterOptions.length > 0 && (
            <button onClick={() => setShowAll(true)} className="text-[#c9b8a4] font-semibold underline underline-offset-4 tap-scale">
              Choisir un créneau plus tard
            </button>
          )}
        </div>
      )}

      {allSlotsConfigured && showAll && displayOptions.length > 0 && (
        <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-3 content-start">
          {displayOptions.map((o) => (
            <button
              key={o.key}
              onClick={() => setSelectedOption(o)}
              className={`tap-scale rounded-2xl py-5 border-2 flex flex-col items-center ${
                selectedOption?.key === o.key ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f] bg-[#211712]"
              }`}
            >
              <span className="display-font text-2xl font-bold">{o.label}</span>
              {o.remaining != null && (
                <span className="text-[#a88f78] text-xs mt-1">
                  {o.remaining} place{o.remaining > 1 ? "s" : ""} dispo
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {allSlotsConfigured && selectedOption && (
        <button onClick={onConfirm} className="tap-scale rounded-full py-6 text-2xl font-bold mt-6" style={{ background: "#C0392B", color: "#fff5ea" }}>
          Valider pour {selectedOption.label}
        </button>
      )}
    </div>
  );
}
