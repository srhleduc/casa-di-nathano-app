"use client";

import { useState } from "react";
import { updateOrder } from "@/lib/data";
import { eur, flavorConfigFor } from "@/lib/menu";
import { cartSignature, lineUnitPrice, remainingForSlot, parseMinutes, formatSlotAllocations } from "@/lib/business";
import OrderScreen from "../OrderScreen";
import PizzaCustomizeModal from "../PizzaCustomizeModal";
import FlavorModal from "../FlavorModal";
import PanuzzoModal from "../PanuzzoModal";

const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };

export default function EditOrderModal({ order, menu, orders, slots, ruptures, dessertStock, pizzaStock, onClose }) {
  const [view, setView] = useState("summary"); // summary | add | slot
  const [activeCat, setActiveCat] = useState("pizza");
  const [items, setItems] = useState(order.items);
  const [selectedSlot, setSelectedSlot] = useState(
    order.slotAllocations && order.slotAllocations.length === 1 ? { id: order.slotAllocations[0].slotId, label: order.slotAllocations[0].label } : null
  );
  const [customizing, setCustomizing] = useState(null);
  const [flavoring, setFlavoring] = useState(null);
  const [panuzzoOrdering, setPanuzzoOrdering] = useState(null);
  const [saving, setSaving] = useState(false);

  const pizzaCount = items.filter((i) => i.cat === "pizza").reduce((s, i) => s + i.qty, 0);
  const total = items.reduce((s, i) => s + lineUnitPrice(i) * i.qty, 0);

  function addItem(item, note) {
    setItems((prev) => {
      const existing = prev.find((i) => cartSignature(i.id, i.note, i.modifiers) === cartSignature(item.id, note, null));
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
      const existing = prev.find((i) => cartSignature(i.id, i.note, i.modifiers) === sig);
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
    setItems((prev) => prev.map((i) => (cartSignature(i.id, i.note, i.modifiers) === sig ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0));
  }

  async function save() {
    const finalSlotAllocations = pizzaCount <= 0 ? [] : selectedSlot ? [{ slotId: selectedSlot.id, label: selectedSlot.label, qty: pizzaCount }] : order.slotAllocations || [];
    setSaving(true);
    try {
      await updateOrder(order.id, { items, slotAllocations: finalSlotAllocations, total, pizzaCount });
      onClose();
    } catch (err) {
      console.error(err);
      alert("Échec de l'enregistrement des modifications.");
      setSaving(false);
    }
  }

  if (view === "add") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
        <div className="flex-1 md:m-8 md:rounded-3xl overflow-hidden flex flex-col" style={{ background: "#1a120b", color: "#f5ebdd" }}>
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
            restaurantName={order.name}
            serviceType={order.serviceType}
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
          <span className="display-font text-2xl font-bold">Modifier « {order.name} »</span>
          <button onClick={onClose} className="tap-scale w-9 h-9 rounded-full bg-[#241811] text-[#c9b8a4] font-bold">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-3 mb-5">
            {items.map((i) => (
              <div
                key={i.id + "-" + (i.note || "") + "-" + (i.modifiers || []).map((m) => m.name).join(",")}
                className="flex items-center justify-between rounded-xl border border-[#3a2b1f] bg-[#211712] px-4 py-3"
              >
                <div>
                  <div className="font-bold">{i.name}</div>
                  {i.note && (
                    <div className="text-xs text-[#E8B23D] pl-3">
                      ↳ {flavorConfigFor(i.name)?.icon || "🍨"} {i.note}
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
                <div className="flex items-center gap-3">
                  <button onClick={() => changeQty(i.id, i.note, i.modifiers, -1)} className="tap-scale w-9 h-9 rounded-full bg-[#3a2b1f] text-xl font-bold">
                    −
                  </button>
                  <span className="w-6 text-center font-bold">{i.qty}</span>
                  <button onClick={() => changeQty(i.id, i.note, i.modifiers, 1)} className="tap-scale w-9 h-9 rounded-full bg-[#3a2b1f] text-xl font-bold">
                    +
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 && <p className="text-[#8a7561]">Plus aucun article — ajoutes-en, ou annule cette commande depuis Caisse.</p>}
          </div>

          <button onClick={() => setView("add")} className="tap-scale w-full rounded-xl py-4 font-bold border-2 border-[#3a2b1f] mb-6">
            + Ajouter un article
          </button>

          {pizzaCount > 0 && (
            <div className="mb-6">
              <div className="text-xs text-[#a88f78] uppercase font-bold mb-2">Créneau</div>
              <div className="flex items-center justify-between rounded-xl border border-[#3a2b1f] bg-[#211712] px-4 py-3">
                <span className="font-bold">
                  {selectedSlot
                    ? `🕐 ${selectedSlot.label}`
                    : order.slotAllocations && order.slotAllocations.length > 0
                    ? `🕐 ${formatSlotAllocations(order.slotAllocations)}`
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
