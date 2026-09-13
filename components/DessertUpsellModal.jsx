"use client";

// Popup "un petit dessert ?" proposé une seule fois, au moment où le client
// valide sa commande en click & collect (voir TakeawayOrder.handleCheckoutConfirm),
// seulement si son panier ne contient encore aucun dessert. N'affiche que les
// desserts effectivement commandables (mêmes règles de disponibilité que
// OrderScreen, calculées par lib/business.availableTakeawayDesserts).

import { useOptionGroups } from "@/lib/data";
import ProductCard from "./ProductCard";

export default function DessertUpsellModal({ items, cart, addItem, changeQty, onGlaceTap, onContinue }) {
  const { forItem } = useOptionGroups();

  function handleIncrement(item) {
    const matches = cart.filter((i) => i.id === item.id);
    const last = matches[matches.length - 1];
    if (last) changeQty(last.id, last.note, last.modifiers, 1);
    else addItem(item);
  }
  function handleDecrement(item) {
    const matches = cart.filter((i) => i.id === item.id);
    const last = matches[matches.length - 1];
    if (last) changeQty(last.id, last.note, last.modifiers, -1);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70">
      <div
        className="w-full md:max-w-2xl md:rounded-3xl overflow-hidden flex flex-col"
        style={{ background: "#1a120b", color: "#f5ebdd", maxHeight: "85vh" }}
      >
        <div className="px-6 py-5 border-b border-[#3a2b1f]">
          <div className="display-font text-2xl font-bold mb-1">🍰 Une petite touche sucrée ?</div>
          <p className="text-[#a88f78] text-sm">Ajoute un dessert à ta commande, ou continue sans.</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-[14px]">
            {items.map((item) => {
              const inCartQty = cart.filter((i) => i.id === item.id).reduce((s, i) => s + i.qty, 0);
              const needsFlavor = forItem(item).length > 0;
              return (
                <ProductCard
                  key={item.id}
                  item={item}
                  inCart={inCartQty}
                  onTap={() => (needsFlavor ? onGlaceTap(item) : addItem(item))}
                  onIncrement={() => handleIncrement(item)}
                  onDecrement={() => handleDecrement(item)}
                />
              );
            })}
          </div>
        </div>

        <div className="px-6 py-5 border-t border-[#3a2b1f]">
          <button onClick={onContinue} className="tap-scale w-full rounded-full py-5 text-xl font-bold" style={{ background: "#e8622c", color: "#150e0a" }}>
            Continuer →
          </button>
        </div>
      </div>
    </div>
  );
}
