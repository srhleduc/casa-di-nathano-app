"use client";

// Choix d'une formule (ex. « La Formule Casa » 20 € = pizza + dessert + soda),
// composant par composant (remplace l'ancienne formule du midi codée en dur).
// Les formules viennent de la table `formulas`
// (Direction → Formules) ; ici on ne fait que présenter les produits encore
// commandables de chaque composant, avec leur supplément éventuel.

import { useState } from "react";
import { eur } from "@/lib/menu";
import { slotChoices } from "@/lib/formulas";

export default function FormulaModal({ formula, menuById, isOrderable, onClose, onConfirm }) {
  const slots = formula.slots || [];
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState([]); // [{ item, supplement }] pour les étapes déjà validées

  const slot = slots[step];
  const choices = slotChoices(slot, menuById, isOrderable);
  const included = choices.filter((c) => c.supplement === 0);
  const withSupplement = choices.filter((c) => c.supplement > 0);

  function choose(choice) {
    const next = [...picks.slice(0, step), choice];
    if (step + 1 >= slots.length) onConfirm(next);
    else {
      setPicks(next);
      setStep(step + 1);
    }
  }
  function back() {
    if (step === 0) onClose();
    else setStep(step - 1);
  }

  const chosenSoFar = picks.slice(0, step);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70">
      <div
        className="pizza-modal w-full md:max-w-2xl md:rounded-3xl overflow-hidden flex flex-col"
        style={{ background: "#1a120b", color: "#f5ebdd", height: "min(85vh, 680px)" }}
      >
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[#3a2b1f]">
          <div className="min-w-0">
            <div className="display-font text-2xl font-bold truncate">
              {formula.name} <span className="text-[#E8B23D]">{eur(formula.price)}</span>
            </div>
            <div className="text-xs text-[#a88f78]">
              Étape {step + 1} sur {slots.length} · {slot?.label}
            </div>
          </div>
          <button onClick={onClose} className="tap-scale w-9 h-9 rounded-full bg-[#241811] text-[#c9b8a4] font-bold shrink-0" aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {chosenSoFar.length > 0 && (
            <div className="mb-4 text-sm text-[#a88f78]">
              {chosenSoFar.map((p, i) => (
                <span key={i}>
                  {i > 0 && " + "}
                  <b className="text-[#c9b8a4]">{p.item.name}</b>
                </span>
              ))}
            </div>
          )}

          <p className="text-[#a88f78] mb-4">Choisis : {slot?.label?.toLowerCase()}</p>

          {included.length > 0 && (
            <>
              {withSupplement.length > 0 && <div className="mb-2 text-xs text-[#a88f78] uppercase font-bold">Inclus</div>}
              <div className="flex flex-wrap gap-2 mb-5">
                {included.map((c) => (
                  <button key={c.item.id} onClick={() => choose(c)} className="chip tap-scale" style={{ color: "#c9b8a4" }}>
                    {c.item.name}
                  </button>
                ))}
              </div>
            </>
          )}
          {withSupplement.length > 0 && (
            <>
              <div className="mb-2 text-xs text-[#a88f78] uppercase font-bold">Avec supplément</div>
              <div className="flex flex-wrap gap-2">
                {withSupplement.map((c) => (
                  <button key={c.item.id} onClick={() => choose(c)} className="chip tap-scale" style={{ color: "#c9b8a4" }}>
                    {c.item.name} <span className="text-[#E8B23D]">(+{eur(c.supplement)})</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {choices.length === 0 && <p className="text-[#8a7561]">Plus aucun choix disponible pour ce composant.</p>}
        </div>

        <div className="px-6 py-4 border-t border-[#3a2b1f]">
          <button onClick={back} className="tap-scale rounded-full px-6 py-3 font-bold border-2 border-[#3a2b1f] text-[#c9b8a4]">
            {step === 0 ? "Annuler" : "← Retour"}
          </button>
        </div>
      </div>
    </div>
  );
}
