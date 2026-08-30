"use client";

import { CATEGORIES, flavorConfigFor, eur, DESSERT_STOCK_GROUPS, DESSERT_TAKEAWAY_FALLBACK_NOTE, PANUZZO_CUTOFF_HOUR } from "@/lib/menu";
import { remainingForDessertGroup, remainingPizzaStock, isTakeawayLike, dessertStockGroupFor, dessertHasSeparateFormats } from "@/lib/business";
import ProductCard from "./ProductCard";

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
  staffMode,
  dessertStockNote,
  clientView,
}) {
  const fullMenu = menu || [];
  const APERO_CATS = ["boisson", "antipasti", "biere", "vin", "cocktail"];
  // Panuzzo/formule vraiment que le midi — masqué passé l'heure de coupure.
  const isPanuzzoTime = new Date().getHours() < PANUZZO_CUTOFF_HOUR;
  const baseCategories = isPanuzzoTime ? CATEGORIES : CATEGORIES.filter((c) => c.key !== "panuzzo");

  const isTakeaway = isTakeawayLike(serviceType);

  // Un produit "sur place uniquement" (coché dans l'admin Menu) est
  // structurellement absent des parcours à emporter : click & collect, borne en
  // mode « à emporter », prise de commande équipe à emporter. À distinguer des
  // ruptures et stocks du jour épuisés, qui sont temporaires et gardent leur
  // onglet (avec message dédié).
  function isStructurallyAvailable(m) {
    return !(isTakeaway && m.dineInOnly);
  }

  // On masque l'onglet d'une catégorie qui n'a plus aucun produit commandable
  // dans ce mode (ex. toutes les salades passées en « sur place uniquement »),
  // ou d'une catégorie sans aucun produit.
  const visibleCategories = (aperoMode ? baseCategories.filter((c) => APERO_CATS.includes(c.key)) : baseCategories).filter((c) =>
    fullMenu.some((m) => m.cat === c.key && isStructurallyAvailable(m))
  );

  // Si la catégorie active vient d'être masquée (ses produits passés en « sur
  // place uniquement »), on retombe sur la première catégorie encore visible.
  const currentCat = visibleCategories.some((c) => c.key === activeCat) ? activeCat : visibleCategories[0]?.key;

  // Dessert épuisé dans son format normal : `fallback` indique qu'une
  // commande sur place peut tout de même être dépannée avec le format à
  // emporter (jamais l'inverse) — réservé aux flux équipe (staffMode), pas à
  // la borne/au click and collect client.
  function dessertAvailability(name) {
    const group = dessertStockGroupFor(DESSERT_STOCK_GROUPS, name, isTakeaway);
    if (!group) return { out: false, fallback: false };
    if (group.unlimited) return { out: false, fallback: false };
    // Illimité côté serveuses uniquement (staffMode) — la borne/le client
    // continuent de décompter (voir DESSERT_STOCK_GROUPS).
    if (staffMode && group.unlimitedStaffOnly) return { out: false, fallback: false };
    if (remainingForDessertGroup(orders || [], dessertStock || {}, group) > 0) return { out: false, fallback: false };
    if (staffMode && !isTakeaway && dessertHasSeparateFormats(DESSERT_STOCK_GROUPS, name)) {
      const takeawayGroup = dessertStockGroupFor(DESSERT_STOCK_GROUPS, name, true);
      if (remainingForDessertGroup(orders || [], dessertStock || {}, takeawayGroup) > 0) return { out: false, fallback: true };
    }
    return { out: true, fallback: false };
  }

  const pizzaStockOut = pizzaStock ? remainingPizzaStock(orders || [], pizzaStock) <= 0 : false;
  function isPizzaOut(cat) {
    return cat === "pizza" && pizzaStockOut;
  }

  const items = fullMenu.filter(
    (m) =>
      m.cat === currentCat &&
      !(ruptures || []).includes(m.id) &&
      !dessertAvailability(m.name).out &&
      !isPizzaOut(m.cat) &&
      !(isTakeaway && m.dineInOnly) &&
      !(m.cat === "panuzzo" && !isPanuzzoTime)
  );

  return (
    <div className="flex-1 flex flex-col min-h-0" style={clientView ? { background: "#150e0a" } : undefined}>
      {clientView ? (
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b" style={{ borderColor: "#3a2a1f" }}>
          {/* Sélecteur segmenté — mono-restaurant pour l'instant (Phase 2 : 2e pill + bascule). */}
          <div className="flex items-center gap-1 rounded-full p-1" style={{ background: "#1c1410" }}>
            <span className="rounded-full px-4 py-2 text-sm font-bold" style={{ background: "#e8622c", color: "#150e0a" }}>
              {restaurantName}
            </span>
          </div>
          <button
            onClick={onCancel}
            className="tap-scale shrink-0 text-sm font-semibold px-4 py-2 rounded-full border"
            style={{ borderColor: "#3a2a1f", color: "#b9a692" }}
          >
            Annuler
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a2b1f]">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌿</span>
            <span className="display-font text-xl font-semibold">{restaurantName}</span>
          </div>
          <button onClick={onCancel} className="text-[#c9b8a4] text-sm font-semibold px-4 py-2 rounded-full border border-[#4a3826] tap-scale">
            Annuler la commande
          </button>
        </div>
      )}

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

      {clientView ? (
        <div className="flex gap-2 px-5 py-3 overflow-x-auto">
          {visibleCategories.map((c) => {
            const on = currentCat === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setActiveCat(c.key)}
                className="tap-scale shrink-0 flex items-center gap-2 rounded-full px-4 py-2.5 border font-bold text-sm"
                style={{
                  background: on ? "#1c1410" : "#1c1410",
                  borderColor: on ? "#d9a94c" : "#3a2a1f",
                  color: on ? "#e4b65b" : "#b9a692",
                }}
              >
                <span className="text-lg">{c.emoji}</span>
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex gap-3 px-6 py-4 overflow-x-auto">
          {visibleCategories.map((c) => (
            <button
              key={c.key}
              onClick={() => setActiveCat(c.key)}
              className={`tap-scale shrink-0 flex flex-col items-center justify-center gap-1 rounded-2xl px-6 py-4 border-2 ${
                currentCat === c.key ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f] bg-[#221812]"
              }`}
            >
              <span className="text-3xl">{c.emoji}</span>
              <span className="text-sm font-bold">{c.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-40">
        {currentCat === "pizza" && pizzaStockOut && (
          <div className="rounded-2xl px-5 py-4 mb-4 text-center" style={{ background: "#2c1c14", border: "1px solid #C0392B" }}>
            <div className="font-bold">🍕 Pizzas épuisées pour ce soir</div>
            <div className="text-[#a88f78] text-sm mt-1">Toutes nos pâtes ont trouvé preneur — le reste du menu reste disponible.</div>
          </div>
        )}
        {currentCat === "dessert" && dessertStockNote && (
          <div className="rounded-2xl px-5 py-3 mb-4 text-center" style={{ background: "#221812", border: "1px solid #3a2b1f" }}>
            <div className="text-[#a88f78] text-sm">{dessertStockNote}</div>
          </div>
        )}
        <div className={clientView ? "grid grid-cols-2 gap-[14px] pt-1" : "grid grid-cols-2 md:grid-cols-3 gap-4"}>
          {items.map((item) => {
            const inCart = cart.filter((i) => i.id === item.id).reduce((s, i) => s + i.qty, 0);
            const needsFlavor = flavorConfigFor(item.name) !== null;
            const isFallback = item.cat === "dessert" && dessertAvailability(item.name).fallback;
            function handleTap() {
              if (item.cat === "pizza" && item.price > 0) onPizzaTap(item);
              else if (item.cat === "panuzzo" && onPanuzzoTap) onPanuzzoTap(item);
              else if (needsFlavor) onGlaceTap(item);
              else if (isFallback) addItem(item, DESSERT_TAKEAWAY_FALLBACK_NOTE);
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
            // Le "+" rajoute simplement un exemplaire de la dernière ligne du
            // panier (mêmes modificateurs) sans rouvrir la modale — sinon
            // personnaliser 13 Regina identiques forçait à repasser par la
            // modale à chaque clic.
            function handleIncrement() {
              const matches = cart.filter((i) => i.id === item.id);
              const last = matches[matches.length - 1];
              if (last) changeQty(last.id, last.note, last.modifiers, 1);
            }
            if (clientView) {
              return (
                <ProductCard
                  key={item.id}
                  item={item}
                  inCart={inCart}
                  onTap={handleTap}
                  onIncrement={handleIncrement}
                  onDecrement={handleDecrement}
                  isFallback={isFallback}
                />
              );
            }
            return (
              <div
                key={item.id}
                onClick={handleTap}
                className={`tap-scale cursor-pointer text-left rounded-2xl bg-[#211712] flex flex-col justify-between min-h-[110px] overflow-hidden ${
                  isFallback ? "border-2" : "border border-[#3a2b1f]"
                }`}
                style={isFallback ? { borderColor: "#ff5fa8" } : undefined}
              >
                {showPhotos && item.photoUrl && <img src={item.photoUrl} alt={item.name} className="w-full h-28 object-cover" />}
                <div className="p-5 flex flex-col flex-1 justify-between">
                  <span className="font-bold text-lg leading-snug">{item.name}</span>
                  {isFallback && (
                    <span className="text-xs font-bold mt-1" style={{ color: "#ff5fa8" }}>
                      🥡 Dépannage à emporter — stock sur place épuisé
                    </span>
                  )}
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
                        <button onClick={handleIncrement} className="tap-scale w-7 h-7 rounded-full text-white text-base font-bold flex items-center justify-center" style={{ background: "#C0392B" }}>
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
        <div
          className={`fixed bottom-0 left-0 right-0 px-6 py-5 flex items-center justify-between ${clientView ? "border-t" : "ticket-edge bg-[#241811] border-t border-[#4a3826]"}`}
          style={clientView ? { background: "#1c1410", borderColor: "#3a2a1f" } : undefined}
        >
          <div>
            <div className="text-sm font-semibold" style={clientView ? { color: "#b9a692" } : { color: "#a88f78" }}>
              {itemCount} article{itemCount > 1 ? "s" : ""}
            </div>
            <div className="display-font text-2xl font-bold" style={clientView ? { color: "#d9a94c" } : { color: "#E8B23D" }}>
              {eur(total)}
            </div>
          </div>
          <button
            onClick={onCheckout}
            className="tap-scale rounded-full px-10 py-5 text-xl font-bold"
            style={clientView ? { background: "#e8622c", color: "#150e0a" } : { background: "#C0392B", color: "#fff5ea" }}
          >
            Voir mon panier →
          </button>
        </div>
      )}
    </div>
  );
}
