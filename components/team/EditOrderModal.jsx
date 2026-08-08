"use client";

import { useState, useEffect } from "react";
import { updateOrder, assignTakeawayNumber, useServiceTypeSettings } from "@/lib/data";
import { eur, flavorConfigFor } from "@/lib/menu";
import { cartSignature, lineUnitPrice, remainingForSlot, parseMinutes, formatSlotAllocations, RESERVED_SERVICE_TYPE, RESERVED_SERVICE_NOTE, TAKEAWAY_SERVICE_TYPE } from "@/lib/business";
import OrderScreen from "../OrderScreen";
import PizzaCustomizeModal from "../PizzaCustomizeModal";
import FlavorModal from "../FlavorModal";
import PanuzzoModal from "../PanuzzoModal";

const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };

const SERVICE_OPTIONS = [
  { value: "🍽️ Sur place", enabledKey: "dineInEnabled" },
  { value: TAKEAWAY_SERVICE_TYPE, enabledKey: "takeawayEnabled" },
  { value: RESERVED_SERVICE_TYPE, enabledKey: "reservedEnabled" },
];

export default function EditOrderModal({ order, menu, orders, slots, ruptures, dessertStock, pizzaStock, onClose }) {
  const { serviceTypeSettings } = useServiceTypeSettings();
  const [view, setView] = useState("summary"); // summary | add | slot
  const [activeCat, setActiveCat] = useState("pizza");
  const [items, setItems] = useState(order.items);
  const [serviceType, setServiceType] = useState(order.serviceType);
  const [name, setName] = useState(order.name);
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
    const wasTakeaway = order.serviceType === TAKEAWAY_SERVICE_TYPE;
    const isTakeawayNow = serviceType === TAKEAWAY_SERVICE_TYPE;
    setSaving(true);
    try {
      const patch = { items, slotAllocations: finalSlotAllocations, total, pizzaCount, serviceType, name: name || "" };
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
            {serviceType === RESERVED_SERVICE_TYPE && <p className="text-[#8a7561] text-xs mb-4">{RESERVED_SERVICE_NOTE}</p>}

            <div className="text-xs text-[#a88f78] uppercase font-bold mb-2">
              {serviceType !== TAKEAWAY_SERVICE_TYPE ? "Numéro de table" : "Nom du client"}
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={serviceType !== TAKEAWAY_SERVICE_TYPE ? "Ex. 12" : "Ex. Julie"}
              className="w-full rounded-xl px-4 py-3 outline-none"
              style={inputStyle}
            />
          </div>

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
