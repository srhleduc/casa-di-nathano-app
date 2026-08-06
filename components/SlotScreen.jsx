"use client";

import { useEffect, useState } from "react";

export default function SlotScreen({ pizzaCount, slotChoice, selectedSlot, setSelectedSlot, allSlotsConfigured, onBack, onConfirm }) {
  const [showAll, setShowAll] = useState(false);
  const mode = slotChoice?.mode;

  useEffect(() => {
    if (mode === "single" && slotChoice.options.length > 0 && !selectedSlot) {
      setSelectedSlot(slotChoice.options[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotChoice]);

  const options = mode === "single" ? slotChoice.options : [];
  const earliest = options[0];
  const laterOptions = options.slice(1);
  const canConfirm = mode === "split" || (mode === "single" && selectedSlot);

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

      {allSlotsConfigured && mode === "single" && earliest && !showAll && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <span className="text-sm font-bold uppercase tracking-wide text-[#a88f78] mb-3">Créneau le plus proche</span>
          <div className="rounded-3xl border-2 border-[#C0392B] bg-[#2c1c14] px-14 py-10 mb-6">
            <div className="display-font text-6xl font-bold">{earliest.label}</div>
            <div className="text-[#a88f78] mt-2">
              {earliest.remaining} place{earliest.remaining > 1 ? "s" : ""} disponible{earliest.remaining > 1 ? "s" : ""}
            </div>
          </div>
          {laterOptions.length > 0 && (
            <button onClick={() => setShowAll(true)} className="text-[#c9b8a4] font-semibold underline underline-offset-4 tap-scale">
              Choisir un créneau plus tard
            </button>
          )}
        </div>
      )}

      {allSlotsConfigured && mode === "single" && showAll && (
        <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-3 content-start">
          {options.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSlot(s)}
              className={`tap-scale rounded-2xl py-5 border-2 flex flex-col items-center ${
                selectedSlot?.id === s.id ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f] bg-[#211712]"
              }`}
            >
              <span className="display-font text-2xl font-bold">{s.label}</span>
              <span className="text-[#a88f78] text-xs mt-1">
                {s.remaining} place{s.remaining > 1 ? "s" : ""} dispo
              </span>
            </button>
          ))}
        </div>
      )}

      {allSlotsConfigured && mode === "split" && (
        <div className="flex-1 flex flex-col justify-center">
          <span className="text-sm font-bold uppercase tracking-wide text-[#a88f78] mb-4 text-center">
            Grosse commande — ton four préfère l'étaler en {slotChoice.plan.length} fournées
          </span>
          <div className="flex flex-col gap-4">
            {slotChoice.plan.map((p, idx) => (
              <div key={p.slotId} className="rounded-2xl border-2 border-[#C0392B] bg-[#2c1c14] px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="w-8 h-8 rounded-full bg-[#C0392B] text-[#fff5ea] font-bold flex items-center justify-center text-sm">{idx + 1}</span>
                  <span className="display-font text-3xl font-bold">{p.label}</span>
                </div>
                <span className="text-[#E8B23D] font-bold">
                  {p.qty} pizza{p.qty > 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
          <p className="text-center text-[#8a7561] text-sm mt-6">Une seule commande, sortie du four en {slotChoice.plan.length} temps — normal pour un grand groupe.</p>
        </div>
      )}

      {allSlotsConfigured && canConfirm && (
        <button onClick={onConfirm} className="tap-scale rounded-full py-6 text-2xl font-bold mt-6" style={{ background: "#C0392B", color: "#fff5ea" }}>
          {mode === "split" ? `Valider mes ${slotChoice.plan.length} fournées` : `Valider pour ${selectedSlot ? selectedSlot.label : "…"}`}
        </button>
      )}
    </div>
  );
}
