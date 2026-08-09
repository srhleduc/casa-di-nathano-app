"use client";

import { CATEGORIES, flavorConfigFor, eur, DESSERT_STOCK_GROUPS, PANUZZO_CUTOFF_HOUR } from "@/lib/menu";
import { remainingForDessertGroup, remainingPizzaStock, isTakeawayLike, dessertStockGroupFor } from "@/lib/business";

export default function OrderScreen({
  activeCat,
  setActiveCat,
  cart,
  addItem,
  onPizzaTap,
  onGlaceTap,
  onPanuzzoTap,
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
  pizzaStock,
  menu,
  showPhotos,
  restaurantName,
  serviceType,
  topBanner,
}) {
  const fullMenu = menu || [];
  const APERO_CATS = ["boisson", "antipasti", "biere", "vin", "cocktail"];
  // Panuzzo/formule vraiment que le midi — masqué passé l'heure de coupure.
  const isPanuzzoTime = new Date().getHours() < PANUZZO_CUTOFF_HOUR;
  const baseCategories = isPanuzzoTime ? CATEGORIES : CATEGORIES.filter((c) => c.key !== "panuzzo");
  const visibleCategories = aperoMode ? baseCategories.filter((c) => APERO_CATS.includes(c.key)) : baseCategories;

  const isTakeaway = isTakeawayLike(serviceType);

  function isDessertOut(name) {
    const group = dessertStockGroupFor(DESSERT_STOCK_GROUPS, name, isTakeaway);
    if (!group) return false;
    return remainingForDessertGroup(orders || [], dessertStock || {}, group) <= 0;
  }

  const pizzaStockOut = pizzaStock ? remainingPizzaStock(orders || [], pizzaStock) <= 0 : false;
  function isPizzaOut(cat) {
    return cat === "pizza" && pizzaStockOut;
  }

  const items = fullMenu.filter(
    (m) =>
      m.cat === activeCat &&
      !(ruptures || []).includes(m.id) &&
      !isDessertOut(m.name) &&
      !isPizzaOut(m.cat) &&
      !(isTakeaway && m.dineInOnly) &&
      !(m.cat === "panuzzo" && !isPanuzzoTime)
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a2b1f]">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌿</span>
          <span className="display-font text-xl font-semibold">{restaurantName}</span>
        </div>
        <button onClick={onCancel} className="text-[#c9b8a4] text-sm font-semibold px-4 py-2 rounded-full border border-[#4a3826] tap-scale">
          Annuler la commande
        </button>
      </div>

      {topBanner}

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

      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-40">
        {activeCat === "pizza" && pizzaStockOut && (
          <div className="rounded-2xl px-5 py-4 mb-4 text-center" style={{ background: "#2c1c14", border: "1px solid #C0392B" }}>
            <div className="font-bold">🍕 Pizzas épuisées pour ce soir</div>
            <div className="text-[#a88f78] text-sm mt-1">Toutes nos pâtes ont trouvé preneur — le reste du menu reste disponible.</div>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {items.map((item) => {
            const inCart = cart.filter((i) => i.id === item.id).reduce((s, i) => s + i.qty, 0);
            const needsFlavor = flavorConfigFor(item.name) !== null;
            function handleTap() {
              if (item.cat === "pizza" && item.price > 0) onPizzaTap(item);
              else if (item.cat === "panuzzo" && onPanuzzoTap) onPanuzzoTap(item);
              else if (needsFlavor) onGlaceTap(item);
              else addItem(item);
            }
            // Retire la dernière ligne de panier correspondant à ce produit,
            // quels que soient sa note/ses modificateurs — permet de corriger
            // un mauvais clic ou un client qui change d'avis sans repasser
            // par le panier.
            function handleDecrement() {
              const matches = cart.filter((i) => i.id === item.id);
              const last = matches[matches.length - 1];
              if (last) changeQty(last.id, last.note, last.modifiers, -1);
            }
            return (
              <div
                key={item.id}
                onClick={handleTap}
                className="tap-scale cursor-pointer text-left rounded-2xl border border-[#3a2b1f] bg-[#211712] flex flex-col justify-between min-h-[110px] overflow-hidden"
              >
                {showPhotos && item.photoUrl && <img src={item.photoUrl} alt={item.name} className="w-full h-28 object-cover" />}
                <div className="p-5 flex flex-col flex-1 justify-between">
                  <span className="font-bold text-lg leading-snug">{item.name}</span>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <span className="display-font italic text-[#E8B23D] text-lg">{item.price === 0 ? "Offert" : eur(item.price)}</span>
                    {inCart > 0 && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 rounded-full pl-1 pr-1 py-1 border border-[#3a2b1f] shrink-0"
                        style={{ background: "#1a120b" }}
                      >
                        <button onClick={handleDecrement} className="tap-scale w-7 h-7 rounded-full bg-[#3a2b1f] text-white text-base font-bold flex items-center justify-center">
                          −
                        </button>
                        <span className="text-sm font-bold w-5 text-center">{inCart}</span>
                        <button onClick={handleTap} className="tap-scale w-7 h-7 rounded-full text-white text-base font-bold flex items-center justify-center" style={{ background: "#C0392B" }}>
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
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
