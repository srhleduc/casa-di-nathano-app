"use client";

import { CATEGORIES, MENU, flavorConfigFor, eur, DESSERT_STOCK_GROUPS } from "@/lib/menu";
import { remainingForDessertGroup } from "@/lib/business";

export default function OrderScreen({
  activeCat,
  setActiveCat,
  cart,
  addItem,
  onPizzaTap,
  onGlaceTap,
  changeQty,
  total,
  itemCount,
  onCancel,
  onCheckout,
  aperoMode,
  onFinishApero,
  ruptures,
  orders,
  dessertStock,
  menu,
  showPhotos,
}) {
  const fullMenu = menu || MENU;
  const APERO_CATS = ["boisson", "antipasti", "biere", "vin", "cocktail"];
  const visibleCategories = aperoMode ? CATEGORIES.filter((c) => APERO_CATS.includes(c.key)) : CATEGORIES;

  function isDessertOut(name) {
    const group = DESSERT_STOCK_GROUPS.find((g) => g.itemNames.includes(name));
    if (!group) return false;
    return remainingForDessertGroup(orders || [], dessertStock || {}, group) <= 0;
  }

  const items = fullMenu.filter((m) => m.cat === activeCat && !(ruptures || []).includes(m.id) && !isDessertOut(m.name));

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a2b1f]">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌿</span>
          <span className="display-font text-xl font-semibold">Casa Di Nathano</span>
        </div>
        <button onClick={onCancel} className="text-[#c9b8a4] text-sm font-semibold px-4 py-2 rounded-full border border-[#4a3826] tap-scale">
          Annuler la commande
        </button>
      </div>

      {aperoMode && (
        <div className="mx-6 mt-4 rounded-2xl px-5 py-4 flex items-center justify-between" style={{ background: "#2c1c14", border: "1px solid #C0392B" }}>
          <div>
            <div className="font-bold">🍸 Commande apéritif</div>
            <div className="text-[#a88f78] text-sm">Boissons et planches — les pizzas arrivent juste après</div>
          </div>
          <button onClick={onFinishApero} className="tap-scale rounded-full px-5 py-3 font-bold text-sm shrink-0" style={{ background: "#C0392B", color: "#fff5ea" }}>
            Valider et poursuivre →
          </button>
        </div>
      )}

      <div className="flex gap-3 px-6 py-4 overflow-x-auto">
        {visibleCategories.map((c) => (
          <button
            key={c.key}
            onClick={() => setActiveCat(c.key)}
            className={`tap-scale shrink-0 flex flex-col items-center justify-center gap-1 rounded-2xl px-6 py-4 border-2 ${
              activeCat === c.key ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f] bg-[#221812]"
            }`}
          >
            <span className="text-3xl">{c.emoji}</span>
            <span className="text-sm font-bold">{c.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-40">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {items.map((item) => {
            const inCart = cart.filter((i) => i.id === item.id).reduce((s, i) => s + i.qty, 0);
            const needsFlavor = flavorConfigFor(item.name) !== null;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.cat === "pizza" && item.price > 0) onPizzaTap(item);
                  else if (needsFlavor) onGlaceTap(item);
                  else addItem(item);
                }}
                className="tap-scale relative text-left rounded-2xl border border-[#3a2b1f] bg-[#211712] flex flex-col justify-between min-h-[110px] overflow-hidden"
              >
                {inCart > 0 && (
                  <span className="absolute top-2 right-2 z-10 bg-[#C0392B] text-white text-sm font-bold rounded-full w-8 h-8 flex items-center justify-center">
                    {inCart}
                  </span>
                )}
                {showPhotos && item.photoUrl && <img src={item.photoUrl} alt={item.name} className="w-full h-28 object-cover" />}
                <div className="p-5 flex flex-col flex-1 justify-between">
                  <span className="font-bold text-lg leading-snug">{item.name}</span>
                  <span className="display-font italic text-[#E8B23D] text-lg mt-2">{item.price === 0 ? "Offert" : eur(item.price)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 px-6 py-5 flex items-center justify-between ticket-edge bg-[#241811] border-t border-[#4a3826]">
          <div>
            <div className="text-sm text-[#a88f78] font-semibold">
              {itemCount} article{itemCount > 1 ? "s" : ""}
            </div>
            <div className="display-font text-2xl font-bold text-[#E8B23D]">{eur(total)}</div>
          </div>
          <button onClick={onCheckout} className="tap-scale rounded-full px-10 py-5 text-xl font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
            Voir mon panier →
          </button>
        </div>
      )}
    </div>
  );
}
