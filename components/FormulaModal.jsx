"use client";

// Choix d'une formule (ex. « La Formule Casa » 20 € = pizza + dessert + soda),
// composant par composant (remplace l'ancienne formule du midi codée en dur).
// Les formules viennent de la table `formulas` (Direction → Formules) ; ici on
// présente les produits encore commandables de chaque composant, avec leur
// supplément éventuel. Une pizza ouvre la personnalisation habituelle
// (« sans oignon », suppléments, note) et un produit à options (parfums des
// glaces/sirops…) ouvre le choix des options, comme dans le menu normal.

import { useState } from "react";
import { eur } from "@/lib/menu";
import { useOptionGroups } from "@/lib/data";
import { slotChoices, needsPizzaCustomization } from "@/lib/formulas";
import PizzaCustomizeModal from "./PizzaCustomizeModal";
import FlavorModal from "./FlavorModal";

// Carte de choix avec packshot (comme dans le menu), photo carrée en haut ;
// un fond neutre garde la grille alignée quand le produit n'a pas de photo.
function ChoiceCard({ choice, onPick }) {
  const { item, supplement } = choice;
  return (
    <button
      onClick={() => onPick(choice)}
      className="tap-scale text-left rounded-2xl overflow-hidden flex flex-col border"
      style={{ background: "#221812", borderColor: "#3a2a1f" }}
    >
      <div className="relative w-full" style={{ aspectRatio: "4 / 3" }}>
        {item.photoUrl ? (
          <img src={item.photoUrl} alt={item.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: "radial-gradient(circle at 50% 38%, #3a2416 0%, #1a120d 78%)" }}
          />
        )}
        {supplement > 0 && (
          <span
            className="absolute top-2 right-2 rounded-full px-2 py-0.5 font-bold"
            style={{ fontSize: 11, background: "rgba(21,14,10,0.78)", border: "1px solid #E8B23D", color: "#E8B23D" }}
          >
            +{eur(supplement)}
          </span>
        )}
      </div>
      <span className="px-3 py-2.5 font-bold leading-snug" style={{ color: "#f5ede3", fontSize: 14 }}>
        {item.name}
      </span>
    </button>
  );
}

export default function FormulaModal({ formula, menu, menuById, isOrderable, ruptures, staffMode, onClose, onConfirm }) {
  const slots = formula.slots || [];
  const { forItem: optionGroupsForItem } = useOptionGroups();
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState([]); // [{ item, supplement, flavorNote?, extra? }] pour les étapes validées
  const [customizing, setCustomizing] = useState(null); // choix de pizza en cours de personnalisation
  const [flavoring, setFlavoring] = useState(null); // choix à options (parfums…) en cours

  const slot = slots[step];
  const choices = slotChoices(slot, menuById, isOrderable);
  const included = choices.filter((c) => c.supplement === 0);
  const withSupplement = choices.filter((c) => c.supplement > 0);

  function advance(pick) {
    const next = [...picks.slice(0, step), pick];
    if (step + 1 >= slots.length) onConfirm(next);
    else {
      setPicks(next);
      setStep(step + 1);
    }
  }
  function choose(choice) {
    if (needsPizzaCustomization(choice.item)) setCustomizing(choice);
    else if (optionGroupsForItem(choice.item).length > 0) setFlavoring(choice);
    else advance(choice);
  }
  function back() {
    if (step === 0) onClose();
    else setStep(step - 1);
  }

  const chosenSoFar = picks.slice(0, step);
  // Prix affiché en tête de la personnalisation : ce que la pizza coûte dans la formule.
  const customizingPrice = customizing ? (step === 0 ? Number(formula.price) || 0 : 0) + customizing.supplement : 0;

  return (
    <>
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
                  {included.map((c) => (
                    <ChoiceCard key={c.item.id} choice={c} onPick={choose} />
                  ))}
                </div>
              </>
            )}
            {withSupplement.length > 0 && (
              <>
                <div className="mb-2 text-xs text-[#a88f78] uppercase font-bold">Avec supplément</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {withSupplement.map((c) => (
                    <ChoiceCard key={c.item.id} choice={c} onPick={choose} />
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

      {customizing && (
        <PizzaCustomizeModal
          pizza={{ ...customizing.item, price: customizingPrice }}
          menu={menu}
          staffMode={staffMode}
          onClose={() => setCustomizing(null)}
          onConfirm={(removedItems, addedItems, itemNote) => {
            const choice = customizing;
            setCustomizing(null);
            advance({
              ...choice,
              extra: {
                modifiers: [...removedItems, ...addedItems].map((i) => ({ name: i.name, price: i.price })),
                itemNote: itemNote || null,
              },
            });
          }}
        />
      )}

      {flavoring && (
        <FlavorModal
          item={flavoring.item}
          ruptures={ruptures}
          onClose={() => setFlavoring(null)}
          onConfirm={(note) => {
            const choice = flavoring;
            setFlavoring(null);
            advance({ ...choice, flavorNote: note || undefined });
          }}
        />
      )}
    </>
  );
}
