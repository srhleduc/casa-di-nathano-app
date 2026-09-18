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

export default function PanuzzoModal({ item, menu, dessertStock, orders, ruptures, serviceType, staffMode, onClose, onAddSolo, onAddFormule }) {
  const [step, setStep] = useState("choice"); // "choice" | "drink" | "dessert"
  const [drink, setDrink] = useState(null);

  const isTakeaway = isTakeawayLike(serviceType);

  function isDessertOut(name) {
    const group = dessertStockGroupFor(DESSERT_STOCK_GROUPS, name, isTakeaway);
    if (!group) return false;
    if (group.unlimited) return false;
    if (staffMode && group.unlimitedStaffOnly) return false; // illimité côté serveuses uniquement
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
      <div className="pizza-modal w-full md:max-w-2xl md:rounded-3xl overflow-hidden flex flex-col" style={{ background: "var(--color-bg)", color: "var(--color-text)", height: "min(85vh, 680px)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
          <span className="display-font text-2xl font-bold">{item.name}</span>
          <button onClick={onClose} className="tap-scale w-9 h-9 rounded-full font-bold" style={{ background: "var(--color-surface)", color: "var(--color-text-subtle)" }}>
            ✕
          </button>
        </div>

        {step === "choice" && (
          <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-4">
            <button
              onClick={() => onAddSolo(item)}
              className="tap-scale rounded-2xl border-2 px-6 py-6 text-left"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface-card)" }}
            >
              <div className="font-bold text-lg mb-1">Sandwich seul</div>
              <div className="display-font text-xl" style={{ color: "var(--color-accent-gold)" }}>{eur(item.price)}</div>
            </button>
            <button
              onClick={() => setStep("drink")}
              className="tap-scale rounded-2xl border-2 px-6 py-6 text-left"
              style={{ borderColor: "var(--color-accent)", background: "var(--color-surface-alt)" }}
            >
              <div className="font-bold text-lg mb-1">🍽️ Formule (sandwich + boisson + dessert)</div>
              <div className="text-sm mb-2" style={{ color: "var(--color-text-muted)" }}>À partir de {eur(FORMULE_PRICE)}</div>
              <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Boisson incluse jusqu'à {eur(FORMULE_DRINK_INCLUDED_MAX)}, dessert inclus jusqu'à {eur(FORMULE_DESSERT_INCLUDED_MAX)} —
                suppléments possibles au-delà.
              </div>
            </button>
          </div>
        )}

        {step === "drink" && (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <p className="mb-4" style={{ color: "var(--color-text-muted)" }}>Choisis une boisson</p>
            <div className="mb-2 text-xs uppercase font-bold" style={{ color: "var(--color-text-muted)" }}>Incluses</div>
            <div className="flex flex-wrap gap-2 mb-5">
              {drinksIncluded.map((d) => (
                <button key={d.id} onClick={() => pickDrink(d)} className="chip tap-scale" style={{ color: "var(--color-text-subtle)" }}>
                  {d.name}
                </button>
              ))}
              {drinksIncluded.length === 0 && <p className="text-sm" style={{ color: "var(--color-text-dim)" }}>Aucune</p>}
            </div>
            <div className="mb-2 text-xs uppercase font-bold" style={{ color: "var(--color-text-muted)" }}>Avec supplément +1,50 €</div>
            <div className="flex flex-wrap gap-2">
              {drinksSupplement.map((d) => (
                <button key={d.id} onClick={() => pickDrink(d)} className="chip tap-scale" style={{ color: "var(--color-text-subtle)" }}>
                  {d.name} <span style={{ color: "var(--color-text-faint)" }}>({eur(d.price)})</span>
                </button>
              ))}
              {drinksSupplement.length === 0 && <p className="text-sm" style={{ color: "var(--color-text-dim)" }}>Aucune</p>}
            </div>
          </div>
        )}

        {step === "dessert" && (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <p className="mb-4" style={{ color: "var(--color-text-muted)" }}>Choisis un dessert</p>
            <div className="mb-2 text-xs uppercase font-bold" style={{ color: "var(--color-text-muted)" }}>Inclus</div>
            <div className="flex flex-wrap gap-2 mb-5">
              {dessertsIncluded.map((d) => (
                <button key={d.id} onClick={() => pickDessert(d)} className="chip tap-scale" style={{ color: "var(--color-text-subtle)" }}>
                  {d.name}
                </button>
              ))}
              {dessertsIncluded.length === 0 && <p className="text-sm" style={{ color: "var(--color-text-dim)" }}>Aucun</p>}
            </div>
            <div className="mb-2 text-xs uppercase font-bold" style={{ color: "var(--color-text-muted)" }}>Avec supplément</div>
            <div className="flex flex-wrap gap-2">
              {dessertsSupplement.map((d) => (
                <button key={d.id} onClick={() => pickDessert(d)} className="chip tap-scale" style={{ color: "var(--color-text-subtle)" }}>
                  {d.name} <span style={{ color: "var(--color-text-faint)" }}>(+{eur(formuleDessertSupplement(d))})</span>
                </button>
              ))}
              {dessertsSupplement.length === 0 && <p className="text-sm" style={{ color: "var(--color-text-dim)" }}>Aucun</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
