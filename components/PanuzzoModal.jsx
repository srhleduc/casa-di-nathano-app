"use client";

import { useState } from "react";
import {
  eur,
  FORMULE_PRICE,
  FORMULE_DRINK_INCLUDED_MAX,
  FORMULE_DESSERT_INCLUDED_MAX,
  isFormuleEligibleDrink,
  formuleDrinkSupplement,
  formuleDessertSupplement,
  DESSERT_STOCK_GROUPS,
} from "@/lib/menu";
import { remainingForDessertGroup, isTakeawayLike, dessertStockGroupFor } from "@/lib/business";

export default function PanuzzoModal({ item, menu, dessertStock, orders, ruptures, serviceType, onClose, onAddSolo, onAddFormule }) {
  const [step, setStep] = useState("choice"); // "choice" | "drink" | "dessert"
  const [drink, setDrink] = useState(null);

  const isTakeaway = isTakeawayLike(serviceType);

  function isDessertOut(name) {
    const group = dessertStockGroupFor(DESSERT_STOCK_GROUPS, name, isTakeaway);
    if (!group) return false;
    return remainingForDessertGroup(orders || [], dessertStock || {}, group) <= 0;
  }

  const drinks = (menu || []).filter((m) => isFormuleEligibleDrink(m) && !(ruptures || []).includes(m.id));
  const drinksIncluded = drinks.filter((d) => d.price <= FORMULE_DRINK_INCLUDED_MAX);
  const drinksSupplement = drinks.filter((d) => d.price > FORMULE_DRINK_INCLUDED_MAX);

  const desserts = (menu || []).filter(
    (m) => m.cat === "dessert" && !(ruptures || []).includes(m.id) && !isDessertOut(m.name) && !(isTakeaway && m.dineInOnly)
  );
  const dessertsIncluded = desserts.filter((d) => d.price <= FORMULE_DESSERT_INCLUDED_MAX);
  const dessertsSupplement = desserts.filter((d) => d.price > FORMULE_DESSERT_INCLUDED_MAX);

  function pickDrink(d) {
    setDrink(d);
    setStep("dessert");
  }
  function pickDessert(d) {
    onAddFormule(item, drink, formuleDrinkSupplement(drink), d, formuleDessertSupplement(d));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70">
      <div className="pizza-modal w-full md:max-w-2xl md:rounded-3xl overflow-hidden flex flex-col" style={{ background: "#1a120b", color: "#f5ebdd", height: "min(85vh, 680px)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a2b1f]">
          <span className="display-font text-2xl font-bold">{item.name}</span>
          <button onClick={onClose} className="tap-scale w-9 h-9 rounded-full bg-[#241811] text-[#c9b8a4] font-bold">
            ✕
          </button>
        </div>

        {step === "choice" && (
          <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-4">
            <button
              onClick={() => onAddSolo(item)}
              className="tap-scale rounded-2xl border-2 border-[#3a2b1f] bg-[#211712] px-6 py-6 text-left"
            >
              <div className="font-bold text-lg mb-1">Sandwich seul</div>
              <div className="display-font text-xl text-[#E8B23D]">{eur(item.price)}</div>
            </button>
            <button
              onClick={() => setStep("drink")}
              className="tap-scale rounded-2xl border-2 px-6 py-6 text-left"
              style={{ borderColor: "#C0392B", background: "#2c1c14" }}
            >
              <div className="font-bold text-lg mb-1">🍽️ Formule (sandwich + boisson + dessert)</div>
              <div className="text-[#a88f78] text-sm mb-2">À partir de {eur(FORMULE_PRICE)}</div>
              <div className="text-[#a88f78] text-xs">
                Boisson incluse jusqu'à {eur(FORMULE_DRINK_INCLUDED_MAX)}, dessert inclus jusqu'à {eur(FORMULE_DESSERT_INCLUDED_MAX)} —
                suppléments possibles au-delà.
              </div>
            </button>
          </div>
        )}

        {step === "drink" && (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <p className="text-[#a88f78] mb-4">Choisis une boisson</p>
            <div className="mb-2 text-xs text-[#a88f78] uppercase font-bold">Incluses</div>
            <div className="flex flex-wrap gap-2 mb-5">
              {drinksIncluded.map((d) => (
                <button key={d.id} onClick={() => pickDrink(d)} className="chip tap-scale" style={{ color: "#c9b8a4" }}>
                  {d.name}
                </button>
              ))}
              {drinksIncluded.length === 0 && <p className="text-[#5a4a3a] text-sm">Aucune</p>}
            </div>
            <div className="mb-2 text-xs text-[#a88f78] uppercase font-bold">Avec supplément +1,50 €</div>
            <div className="flex flex-wrap gap-2">
              {drinksSupplement.map((d) => (
                <button key={d.id} onClick={() => pickDrink(d)} className="chip tap-scale" style={{ color: "#c9b8a4" }}>
                  {d.name} <span className="text-[#8a7561]">({eur(d.price)})</span>
                </button>
              ))}
              {drinksSupplement.length === 0 && <p className="text-[#5a4a3a] text-sm">Aucune</p>}
            </div>
          </div>
        )}

        {step === "dessert" && (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <p className="text-[#a88f78] mb-4">Choisis un dessert</p>
            <div className="mb-2 text-xs text-[#a88f78] uppercase font-bold">Inclus</div>
            <div className="flex flex-wrap gap-2 mb-5">
              {dessertsIncluded.map((d) => (
                <button key={d.id} onClick={() => pickDessert(d)} className="chip tap-scale" style={{ color: "#c9b8a4" }}>
                  {d.name}
                </button>
              ))}
              {dessertsIncluded.length === 0 && <p className="text-[#5a4a3a] text-sm">Aucun</p>}
            </div>
            <div className="mb-2 text-xs text-[#a88f78] uppercase font-bold">Avec supplément</div>
            <div className="flex flex-wrap gap-2">
              {dessertsSupplement.map((d) => (
                <button key={d.id} onClick={() => pickDessert(d)} className="chip tap-scale" style={{ color: "#c9b8a4" }}>
                  {d.name} <span className="text-[#8a7561]">(+{eur(formuleDessertSupplement(d))})</span>
                </button>
              ))}
              {dessertsSupplement.length === 0 && <p className="text-[#5a4a3a] text-sm">Aucun</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
