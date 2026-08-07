"use client";

import { useState } from "react";
import { useOrders, useMenu, useRuptures, useDessertStock, usePizzaStock, useSlots, updateOrder } from "@/lib/data";
import { isOrderActiveToday, sortOrdersByTime, TAKEAWAY_SERVICE_TYPE } from "@/lib/business";
import ItemLine from "../ItemLine";
import OrderCardHeader from "../OrderCardHeader";
import ElapsedBadge from "../ElapsedBadge";
import EditOrderModal from "./EditOrderModal";

export default function FinitionBoard() {
  const { orders } = useOrders();
  const { menuItems } = useMenu();
  const { ruptures } = useRuptures();
  const { dessertStock } = useDessertStock();
  const { pizzaStock } = usePizzaStock();
  const { slots } = useSlots();
  const [editingOrder, setEditingOrder] = useState(null);
  const active = orders.filter((o) => o.status !== "servie" && isOrderActiveToday(o));
  // Concerné par Finition : les planches/salades pas encore marquées prêtes, les commandes
  // qui viennent de sortir du four (garniture après-cuisson), ou celles sans pizza du tout.
  // Une commande passée en "pret_service" a fini son passage en Finition, quoi qu'il arrive.
  const toHandle = active.filter((o) => {
    if (o.status === "pret_service") return false;
    const prepPending = o.items.some((it) => it.cat === "antipasti" || it.cat === "salade") && !o.prepServed;
    const needsGarnish = o.status === "prete";
    const noPizzaAtAll = o.pizzaCount === 0;
    return prepPending || needsGarnish || noPizzaAtAll;
  });
  // À emporter, terminées côté Finition : elles restent visibles ici (pour que
  // l'équipe sache ce qui attend d'être remis au client) jusqu'à ce que Caisse
  // les marque payées — contrairement au sur place, qui quitte cet écran dès
  // "Terminé → Service".
  const readyTakeaway = active.filter((o) => o.status === "pret_service" && o.serviceType === TAKEAWAY_SERVICE_TYPE);

  function markPrepDone(order) {
    updateOrder(order.id, { prepServed: true }).catch((err) => console.error(err));
  }
  function markDone(order) {
    updateOrder(order.id, { status: "pret_service", finitionDoneAt: new Date().toISOString() }).catch((err) => console.error(err));
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <p className="text-[#a88f78] mb-4 text-sm">Planches, salades et garniture après-cuisson des pizzas — dès qu'elles sortent du four.</p>
      {toHandle.length === 0 && <p className="text-[#8a7561]">Rien à préparer pour l'instant.</p>}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {sortOrdersByTime(toHandle).map((o) => {
          const prepItems = o.items.filter((it) => it.cat === "antipasti" || it.cat === "salade");
          const prepPending = prepItems.length > 0 && !o.prepServed;
          const needsGarnish = o.status === "prete";
          const canFinishService = needsGarnish || o.pizzaCount === 0;
          return (
            <div key={o.id} className="w-72 shrink-0 rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
              <OrderCardHeader order={o} onEdit={() => setEditingOrder(o)} />
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="display-font text-lg font-bold">{o.name}</div>
                <ElapsedBadge since={o.ovenDoneAt || o.createdAt} />
              </div>
              {prepPending && (
                <div className="mb-2">
                  <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Planches / salades</div>
                  <ul className="text-sm text-[#c9b8a4] mb-2">
                    {prepItems.map((it, idx) => (
                      <ItemLine key={idx} it={it} />
                    ))}
                  </ul>
                  <button onClick={() => markPrepDone(o)} className="tap-scale w-full rounded-xl py-3 text-sm font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
                    🥗 Planches / salades prêtes
                  </button>
                </div>
              )}
              {needsGarnish && (
                <div className="mb-2">
                  <div className="text-xs text-[#E8B23D] uppercase font-bold mb-1">🔥 Sortie du four — à garnir</div>
                  <ul className="text-sm text-[#c9b8a4]">
                    {o.items
                      .filter((it) => it.cat === "pizza")
                      .map((it, idx) => (
                        <ItemLine key={idx} it={it} />
                      ))}
                  </ul>
                </div>
              )}
              {canFinishService && (
                <button onClick={() => markDone(o)} className="tap-scale w-full rounded-xl py-3 text-sm font-bold mt-2" style={{ background: "#C0392B", color: "#fff5ea" }}>
                  ✅ Terminé → Service
                </button>
              )}
            </div>
          );
        })}
      </div>

      {readyTakeaway.length > 0 && (
        <div className="mt-8 pt-6 border-t border-[#3a2b1f]">
          <div className="font-bold mb-1">📦 À emporter — prêtes, en attente de retrait ({readyTakeaway.length})</div>
          <p className="text-[#a88f78] mb-4 text-sm">Disparaissent d'ici une fois marquées payées en Caisse.</p>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {sortOrdersByTime(readyTakeaway).map((o) => (
              <div key={o.id} className="w-72 shrink-0 rounded-xl border-2 p-4" style={{ borderColor: "#3a2b1f", background: "#211712" }}>
                <OrderCardHeader order={o} onEdit={() => setEditingOrder(o)} />
                <div className="display-font text-lg font-bold mb-2">{o.name}</div>
                <ul className="text-sm text-[#c9b8a4]">
                  {o.items.map((it, idx) => (
                    <ItemLine key={idx} it={it} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

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
