"use client";

import { useState } from "react";
import { useOrders, useMenu, useRuptures, useDessertStock, usePizzaStock, useSlots, updateOrder } from "@/lib/data";
import { isOrderActiveToday, sortOrdersByTime, sortKitchenQueue, serviceTypeBadgeStyle, formatSlotAllocations, TAKEAWAY_SERVICE_TYPE } from "@/lib/business";
import { eur } from "@/lib/menu";
import ItemLine from "../ItemLine";
import ElapsedBadge from "../ElapsedBadge";
import LiveClock from "../LiveClock";
import EditOrderModal from "./EditOrderModal";

export default function KitchenBoard() {
  const { orders } = useOrders();
  const { menuItems } = useMenu();
  const { ruptures } = useRuptures();
  const { dessertStock } = useDessertStock();
  const { pizzaStock } = usePizzaStock();
  const { slots } = useSlots();
  const [editingOrder, setEditingOrder] = useState(null);
  const active = orders.filter((o) => o.status !== "servie" && isOrderActiveToday(o));
  const aperoWaiting = active.filter((o) => o.aperoStatus === "waiting");

  // Une commande de la file du four doit avoir des pizzas "hors apéro" à faire,
  // et ne pas être en train d'attendre son apéro.
  function normalPizzaItems(o) {
    return o.items.filter((it) => (it.cat === "pizza" || it.cat === "panuzzo" || it.cat === "supplement" || it.cat === "sans") && it.phase !== "apero");
  }
  function isNormalQueueOrder(o) {
    return !["waiting", "served_by_kitchen"].includes(o.aperoStatus) && normalPizzaItems(o).length > 0;
  }

  const queue = sortKitchenQueue(active.filter((o) => (o.status === "attente" || o.status === "preparation") && isNormalQueueOrder(o)));
  const takeawayQueue = queue.filter((o) => o.serviceType === TAKEAWAY_SERVICE_TYPE);
  const dineInQueue = queue.filter((o) => o.serviceType !== TAKEAWAY_SERVICE_TYPE);

  function sendToFinition(order) {
    updateOrder(order.id, { status: "prete", ovenDoneAt: new Date().toISOString() }).catch((err) => console.error(err));
  }
  function markAperoServed(order) {
    updateOrder(order.id, { aperoStatus: "served_by_kitchen" }).catch((err) => console.error(err));
  }

  function renderOrderCard(o) {
    return (
      <div key={o.id} className="w-72 shrink-0 rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {o.takeawayNumber != null && (
              <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "#C0392B", color: "#fff5ea" }}>
                N°{o.takeawayNumber}
              </span>
            )}
            <span className="text-xs font-bold rounded-full px-3 py-1" style={serviceTypeBadgeStyle(o.serviceType)}>
              {o.serviceType}
            </span>
            {o.isTest && (
              <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "#4a3a10", color: "#f0c860" }}>
                🧪 TEST
              </span>
            )}
            <button onClick={() => setEditingOrder(o)} className="tap-scale text-xs font-bold rounded-full px-3 py-1 border-2 border-[#3a2b1f]">
              ✏️
            </button>
          </div>
        </div>
        {o.slotAllocations && o.slotAllocations.length > 0 && (
          <div className="display-font text-3xl font-bold text-[#E8B23D] mb-1">🕐 {formatSlotAllocations(o.slotAllocations)}</div>
        )}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="display-font text-xl font-bold">{o.name}</div>
          <ElapsedBadge since={o.createdAt} />
        </div>
        <ul className="text-sm text-[#c9b8a4] mb-3">
          {normalPizzaItems(o).map((it, idx) => (
            <ItemLine key={idx} it={it} />
          ))}
        </ul>
        <div className="display-font font-bold text-[#E8B23D] mb-3">{eur(o.total)}</div>
        <button onClick={() => sendToFinition(o)} className="tap-scale w-full rounded-xl py-4 text-lg font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
          🔥 Four
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <LiveClock
        className="fixed top-20 right-6 z-30 display-font text-4xl font-bold tabular-nums rounded-2xl px-6 py-3 border-2"
        style={{ borderColor: "#3a2b1f", background: "#211712", color: "#E8B23D" }}
      />

      {aperoWaiting.length > 0 && (
        <div className="mb-6">
          <div className="font-bold mb-3">🍸 Apéro à préparer ({aperoWaiting.length})</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sortOrdersByTime(aperoWaiting).map((o) => {
              const aperoItems = o.items.filter((it) => (it.cat === "pizza" || it.cat === "supplement" || it.cat === "sans") && it.phase === "apero");
              return (
                <div key={o.id} className="rounded-xl border-2 p-4" style={{ borderColor: "#C0392B", background: "#2c1c14" }}>
                  <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                    <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "#4a2c14", color: "#E8B23D" }}>
                      ⏳ Attente apéro
                    </span>
                    <div className="flex items-center gap-2">
                      {o.isTest && (
                        <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "#4a3a10", color: "#f0c860" }}>
                          🧪 TEST
                        </span>
                      )}
                      <button onClick={() => setEditingOrder(o)} className="tap-scale text-xs font-bold rounded-full px-3 py-1 border-2 border-[#3a2b1f]">
                        ✏️
                      </button>
                    </div>
                  </div>
                  <div className="display-font text-xl font-bold mb-2">{o.name}</div>
                  <ul className="text-sm text-[#c9b8a4] mb-3">
                    {aperoItems.map((it, idx) => (
                      <ItemLine key={idx} it={it} />
                    ))}
                  </ul>
                  <button onClick={() => markAperoServed(o)} className="tap-scale w-full rounded-xl py-4 text-lg font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
                    ✅ Apéro servi
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="font-bold mb-3">🥡 À emporter ({takeawayQueue.length})</div>
      <div className="flex gap-4 overflow-x-auto pb-2 mb-6">
        {takeawayQueue.map(renderOrderCard)}
        {takeawayQueue.length === 0 && <p className="text-[#8a7561]">Aucune pour l'instant.</p>}
      </div>

      <div className="font-bold mb-3">🍽️ Sur place ({dineInQueue.length})</div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {dineInQueue.map(renderOrderCard)}
        {dineInQueue.length === 0 && <p className="text-[#8a7561]">Aucune pour l'instant.</p>}
      </div>

      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          menu={menuItems}
          orders={orders}
          slots={slots}
          ruptures={ruptures}
          dessertStock={dessertStock}
          pizzaStock={pizzaStock}
          onClose={() => setEditingOrder(null)}
        />
      )}
    </div>
  );
}
