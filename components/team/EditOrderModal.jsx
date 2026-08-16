"use client";

import { useState, useEffect } from "react";
import { updateOrder, assignTakeawayNumber, useServiceTypeSettings } from "@/lib/data";
import { eur, noteIcon } from "@/lib/menu";
import { cartSignature, lineUnitPrice, remainingForSlot, parseMinutes, formatSlotAllocations, computeSlotOptions, earliestSlotPlan, TAKEAWAY_SERVICE_TYPE, IMMEDIATE_TAKEAWAY_SERVICE_TYPE, isTakeawayLike } from "@/lib/business";
import OrderScreen from "../OrderScreen";
import PizzaCustomizeModal from "../PizzaCustomizeModal";
import FlavorModal from "../FlavorModal";
import PanuzzoModal from "../PanuzzoModal";

const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };

// Catégories qui passent par le four et/ou la Finition (contrairement aux
// boissons/desserts, qui se gèrent uniquement au niveau de l'article et
// n'ont pas besoin de ce recalcul — voir BoissonBoard/DessertCafeBoard).
const KITCHEN_PIPELINE_CATS = ["pizza", "panuzzo", "supplement", "sans", "antipasti", "salade"];
function kitchenPendingQty(items) {
  return items
    .filter((i) => !i.served && i.phase !== "apero" && KITCHEN_PIPELINE_CATS.includes(i.cat))
    .reduce((s, i) => s + i.qty, 0);
}

const SERVICE_OPTIONS = [
  { value: "🍽️ Sur place", enabledKey: "dineInEnabled" },
  { value: TAKEAWAY_SERVICE_TYPE, enabledKey: "takeawayEnabled" },
  { value: IMMEDIATE_TAKEAWAY_SERVICE_TYPE, enabledKey: "takeawayEnabled" },
];

export default function EditOrderModal({ order, menu, orders, slots, ruptures, dessertStock, pizzaStock, onClose }) {
  const { serviceTypeSettings } = useServiceTypeSettings();
  const [view, setView] = useState("summary"); // summary | add | slot
  const [activeCat, setActiveCat] = useState("pizza");
  const [items, setItems] = useState(order.items);
  const [serviceType, setServiceType] = useState(order.serviceType);
  const [name, setName] = useState(order.name);
  const [note, setNote] = useState(order.note || "");
  const [selectedSlot, setSelectedSlot] = useState(
    order.slotAllocations && order.slotAllocations.length === 1 ? { id: order.slotAllocations[0].slotId, label: order.slotAllocations[0].label } : null
  );
  const [customizing, setCustomizing] = useState(null);
  const [flavoring, setFlavoring] = useState(null);
  const [panuzzoOrdering, setPanuzzoOrdering] = useState(null);
  const [saving, setSaving] = useState(false);

  const availableServiceOptions = SERVICE_OPTIONS.filter((o) => serviceTypeSettings[o.enabledKey] || o.value === order.serviceType);

  // Sur mobile, si la page équipe derrière la modale reste défilable, le
  // geste de glissement tactile est parfois capté par la page plutôt que par
  // la liste de produits — la barre de défilement de la modale existe mais
  // ne répond plus. On bloque donc le défilement de la page tant que la
  // modale est ouverte.
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const pizzaCount = items.filter((i) => i.cat === "pizza").reduce((s, i) => s + i.qty, 0);
  const total = items.reduce((s, i) => s + lineUnitPrice(i) * i.qty, 0);

  // Un article déjà marqué "servi" (boisson pointée sur l'écran Boissons,
  // pizza déjà envoyée en cuisine...) forme une ligne à part : on ne
  // fusionne jamais un ajout dedans, sinon la nouvelle quantité hériterait
  // du statut "déjà servi" et disparaîtrait des écrans équipe.
  function addItem(item, note) {
    setItems((prev) => {
      const existing = prev.find((i) => !i.served && cartSignature(i.id, i.note, i.modifiers) === cartSignature(item.id, note, null));
      if (existing) return prev.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { ...item, qty: 1, note: note || null, modifiers: [] }];
    });
  }
  function addCustomizedPizza(pizzaItem, removedItems, addedItems) {
    const modifiers = [
      ...removedItems.map((i) => ({ name: i.name, price: i.price })),
      ...addedItems.map((i) => ({ name: i.name, price: i.price })),
    ];
    setItems((prev) => {
      const sig = cartSignature(pizzaItem.id, null, modifiers);
      const existing = prev.find((i) => !i.served && cartSignature(i.id, i.note, i.modifiers) === sig);
      if (existing) return prev.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { ...pizzaItem, qty: 1, note: null, modifiers }];
    });
    setCustomizing(null);
  }
  function addFormule(sandwich, drinkItem, drinkSupplement, dessertItem, dessertSupplement) {
    addItem({ ...sandwich, price: 14.5 }, "Formule");
    addItem({ ...drinkItem, price: drinkSupplement }, drinkSupplement > 0 ? `Formule +${eur(drinkSupplement)}` : "Formule (incluse)");
    addItem({ ...dessertItem, price: dessertSupplement }, dessertSupplement > 0 ? `Formule +${eur(dessertSupplement)}` : "Formule (inclus)");
    setPanuzzoOrdering(null);
  }
  function changeQty(id, note, modifiers, delta) {
    const sig = cartSignature(id, note, modifiers);
    setItems((prev) => prev.map((i) => (!i.served && cartSignature(i.id, i.note, i.modifiers) === sig ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0));
  }
  // Reprendre un article déjà servi (le client en veut un autre) — repart
  // sur une ligne neuve non servie, sans modificateurs ni note conservés.
  function reorderItem(i) {
    addItem({ id: i.id, name: i.name, price: i.price, cat: i.cat });
  }

  async function save() {
    // "À emporter tout de suite" ne réserve jamais de créneau, quel que soit
    // ce que la commande avait avant (ex. bascule depuis sur place). Idem pour
    // "Sur place" si le pizzaiolo a désactivé le décompte des créneaux pour ce
    // type de service (voir SlotsAdmin) — le pâton reste décompté dans tous
    // les cas via pizzaCount.
    const dineInSkipsSlot = serviceType === "🍽️ Sur place" && serviceTypeSettings.dineInCountsTowardSlots === false;
    let finalSlotAllocations =
      pizzaCount <= 0 || serviceType === IMMEDIATE_TAKEAWAY_SERVICE_TYPE || dineInSkipsSlot
        ? []
        : selectedSlot
        ? [{ slotId: selectedSlot.id, label: selectedSlot.label, qty: pizzaCount }]
        : order.slotAllocations || [];
    if (pizzaCount > 0 && !selectedSlot && finalSlotAllocations.length === 0 && serviceType === "🍽️ Sur place" && !dineInSkipsSlot) {
      // Sur place sans créneau existant (nouvelles pizzas ajoutées, ou
      // bascule depuis à emporter) : on réserve automatiquement le créneau
      // le plus proche, comme à la prise de commande.
      const otherOrders = orders.filter((o) => o.id !== order.id);
      const choice = computeSlotOptions(otherOrders, slots, pizzaCount);
      finalSlotAllocations = earliestSlotPlan(choice, pizzaCount) || [];
    }
    const wasTakeaway = isTakeawayLike(order.serviceType);
    const isTakeawayNow = isTakeawayLike(serviceType);
    setSaving(true);
    try {
      const patch = { items, slotAllocations: finalSlotAllocations, total, pizzaCount, serviceType, name: name || "", note: note.trim() || null };
      // Une commande déjà passée le four/la Finition ("prête", "prêt à
      // servir" ou même déjà "servie") n'y repasse jamais tant que son
      // statut ne bouge pas : si le client redemande une pizza en plein
      // repas, le nouvel article ajouté ici resterait invisible de l'écran
      // Four. On rouvre donc le circuit dès qu'on ajoute du nouveau à
      // préparer sur une commande qui avait déjà dépassé cette étape.
      if (!["attente", "preparation"].includes(order.status) && kitchenPendingQty(items) > kitchenPendingQty(order.items)) {
        patch.status = "attente";
        patch.delivered = false;
      }
      if (order.aperoStatus === "served_by_kitchen") {
        // L'apéro a déjà été préparé et servi — cette commande continue
        // maintenant normalement, plus rien à retenir avant le four.
        patch.aperoStatus = "released";
      }
      if (isTakeawayNow && !wasTakeaway && order.takeawayNumber == null) {
        patch.takeawayNumber = await assignTakeawayNumber();
      } else if (!isTakeawayNow && wasTakeaway) {
        patch.takeawayNumber = null;
      }
      await updateOrder(order.id, patch);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Échec de l'enregistrement des modifications.");
      setSaving(false);
    }
  }

  if (view === "add") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ background: "#1a120b", color: "#f5ebdd", height: "100vh" }}>
        <OrderScreen
          activeCat={activeCat}
          setActiveCat={setActiveCat}
          cart={items}
          addItem={addItem}
          onPizzaTap={setCustomizing}
          onGlaceTap={setFlavoring}
          onPanuzzoTap={setPanuzzoOrdering}
          changeQty={changeQty}
          total={total}
          itemCount={items.reduce((s, i) => s + i.qty, 0)}
          onCancel={() => setView("summary")}
          onCheckout={() => setView("summary")}
          aperoMode={false}
          ruptures={ruptures}
          orders={orders}
          dessertStock={dessertStock}
          pizzaStock={pizzaStock}
          menu={menu}
          restaurantName={name || order.name}
          serviceType={serviceType}
          staffMode
          onFinishApero={() => {}}
        />
        {customizing && (
          <PizzaCustomizeModal
            pizza={customizing}
            menu={menu}
            onClose={() => setCustomizing(null)}
            onConfirm={(removedItems, addedItems) => addCustomizedPizza(customizing, removedItems, addedItems)}
          />
        )}
        {flavoring && (
          <FlavorModal
            item={flavoring}
            onClose={() => setFlavoring(null)}
            onConfirm={(note) => {
              addItem(flavoring, note);
              setFlavoring(null);
            }}
          />
        )}
        {panuzzoOrdering && (
          <PanuzzoModal
            item={panuzzoOrdering}
            menu={menu}
            dessertStock={dessertStock}
            orders={orders}
            ruptures={ruptures}
            serviceType={order.serviceType}
            onClose={() => setPanuzzoOrdering(null)}
            onAddSolo={(item) => {
              addItem(item);
              setPanuzzoOrdering(null);
            }}
            onAddFormule={addFormule}
          />
        )}
      </div>
    );
  }

  if (view === "slot") {
    const otherOrders = orders.filter((o) => o.id !== order.id);
    const slotOptions = slots
      .map((s) => ({ ...s, remaining: remainingForSlot(otherOrders, s) }))
      .sort((a, b) => (parseMinutes(a.label) ?? 0) - (parseMinutes(b.label) ?? 0));
    return (
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70">
        <div className="pizza-modal w-full md:max-w-2xl md:rounded-3xl overflow-hidden flex flex-col" style={{ background: "#1a120b", color: "#f5ebdd", height: "min(85vh, 680px)" }}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a2b1f]">
            <span className="display-font text-2xl font-bold">Changer de créneau</span>
            <button onClick={() => setView("summary")} className="tap-scale w-9 h-9 rounded-full bg-[#241811] text-[#c9b8a4] font-bold">
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 grid grid-cols-3 gap-3 content-start">
            {slotOptions.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedSlot({ id: s.id, label: s.label });
                  setView("summary");
                }}
                className="tap-scale rounded-2xl py-5 border-2 flex flex-col items-center"
                style={selectedSlot?.id === s.id ? { borderColor: "#C0392B", background: "#2c1c14" } : { borderColor: "#3a2b1f", background: "#211712" }}
              >
                <span className="display-font text-2xl font-bold">{s.label}</span>
                <span className="text-[#a88f78] text-xs mt-1">{s.remaining} place{s.remaining > 1 ? "s" : ""} dispo</span>
              </button>
            ))}
            {slotOptions.length === 0 && <p className="text-[#8a7561] col-span-3">Aucun créneau ouvert.</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70">
      <div className="pizza-modal w-full md:max-w-2xl md:rounded-3xl overflow-hidden flex flex-col" style={{ background: "#1a120b", color: "#f5ebdd", height: "min(90vh, 720px)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a2b1f]">
          <span className="display-font text-2xl font-bold">Modifier « {name || order.name} »</span>
          <button onClick={onClose} className="tap-scale w-9 h-9 rounded-full bg-[#241811] text-[#c9b8a4] font-bold">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-6">
            <div className="text-xs text-[#a88f78] uppercase font-bold mb-2">Type de commande</div>
            <div className="flex flex-wrap gap-2 mb-4">
              {availableServiceOptions.map((o) => {
                const isSelected = serviceType === o.value;
                return (
                  <button
                    key={o.value}
                    onClick={() => setServiceType(o.value)}
                    className="tap-scale flex-1 min-w-[140px] rounded-xl py-3 px-2 font-bold border-2 text-center text-sm"
                    style={isSelected ? { background: "#C0392B", borderColor: "#C0392B", color: "#fff5ea" } : { background: "#211712", borderColor: "#3a2b1f", color: "#a88f78" }}
                  >
                    {isSelected && "✓ "}
                    {o.value}
                  </button>
                );
              })}
            </div>
            <div className="text-xs text-[#a88f78] uppercase font-bold mb-2">
              {!isTakeawayLike(serviceType) ? "Numéro de table" : "Nom du client"}
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={!isTakeawayLike(serviceType) ? "Ex. 12" : "Ex. Julie"}
              className="w-full rounded-xl px-4 py-3 outline-none"
              style={inputStyle}
            />
            <div className="text-xs uppercase font-bold mb-2 mt-4" style={{ color: "#ff5fa8" }}>
              📝 Note pour l'équipe
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex. Allergie noix, client pressé, anniversaire…"
              rows={2}
              className="w-full rounded-xl px-4 py-3 outline-none resize-none"
              style={inputStyle}
            />
          </div>

          <div className="flex flex-col gap-3 mb-5">
            {items.map((i, idx) => (
              <div
                key={i.id + "-" + (i.note || "") + "-" + (i.modifiers || []).map((m) => m.name).join(",") + "-" + (i.served ? "servi" : "pending") + "-" + idx}
                className="flex items-center justify-between rounded-xl border px-4 py-3"
                style={i.served ? { borderColor: "#204a3a", background: "#1a2620" } : { borderColor: "#3a2b1f", background: "#211712" }}
              >
                <div>
                  <div className="font-bold flex items-center gap-2">
                    {i.name}
                    {i.served && (
                      <span className="text-xs font-bold rounded-full px-2 py-0.5" style={{ background: "#204a3a", color: "#a8e8c8" }}>
                        ✅ Servi
                      </span>
                    )}
                  </div>
                  {i.note && (
                    <div className="text-xs text-[#E8B23D] pl-3">
                      ↳ {noteIcon(i.name, i.note)} {i.note}
                    </div>
                  )}
                  {(i.modifiers || []).map((m, mi) => (
                    <div key={mi} className="text-xs text-[#a88f78] pl-3">
                      ↳ {m.name}
                      {m.price > 0 ? ` (+${eur(m.price)})` : ""}
                    </div>
                  ))}
                  <div className="text-[#a88f78] text-sm mt-1">{eur(lineUnitPrice(i))} / unité</div>
                </div>
                {i.served ? (
                  <div className="flex items-center gap-3">
                    <span className="text-center font-bold text-[#a88f78]">×{i.qty}</span>
                    <button onClick={() => reorderItem(i)} className="tap-scale text-xs font-bold rounded-full px-3 py-2 border-2 border-[#3a2b1f]">
                      +1
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button onClick={() => changeQty(i.id, i.note, i.modifiers, -1)} className="tap-scale w-9 h-9 rounded-full bg-[#3a2b1f] text-xl font-bold">
                      −
                    </button>
                    <span className="w-6 text-center font-bold">{i.qty}</span>
                    <button onClick={() => changeQty(i.id, i.note, i.modifiers, 1)} className="tap-scale w-9 h-9 rounded-full bg-[#3a2b1f] text-xl font-bold">
                      +
                    </button>
                  </div>
                )}
              </div>
            ))}
            {items.length === 0 && <p className="text-[#8a7561]">Plus aucun article — ajoutes-en, ou annule cette commande depuis Caisse.</p>}
          </div>

          <button onClick={() => setView("add")} className="tap-scale w-full rounded-xl py-4 font-bold border-2 border-[#3a2b1f] mb-6">
            + Ajouter un article
          </button>

          {pizzaCount > 0 && serviceType === TAKEAWAY_SERVICE_TYPE && (
            <div className="mb-6">
              <div className="text-xs text-[#a88f78] uppercase font-bold mb-2">Créneau</div>
              <div className="flex items-center justify-between rounded-xl border border-[#3a2b1f] bg-[#211712] px-4 py-3">
                <span className="font-bold">
                  {selectedSlot
                    ? `🕐 ${selectedSlot.label}`
                    : order.slotAllocations && order.slotAllocations.length > 0
                    ? `🕐 ${formatSlotAllocations(order.slotAllocations)}`
                    : order.scheduledTime
                    ? `🕐 ${order.scheduledTime}`
                    : "Aucun créneau"}
                </span>
                <button onClick={() => setView("slot")} className="tap-scale text-xs font-bold rounded-full px-4 py-2 border-2 border-[#3a2b1f]">
                  Changer
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <span className="text-xl font-bold">Total</span>
            <span className="display-font text-3xl font-bold text-[#E8B23D]">{eur(total)}</span>
          </div>
        </div>

        <div className="px-6 py-5 border-t border-[#3a2b1f]">
          <button onClick={save} disabled={saving} className="tap-scale w-full rounded-full py-5 text-xl font-bold disabled:opacity-40" style={{ background: "#C0392B", color: "#fff5ea" }}>
            {saving ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        </div>
      </div>
    </div>
  );
}
