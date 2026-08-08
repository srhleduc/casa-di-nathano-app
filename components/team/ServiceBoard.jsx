"use client";

import { useState } from "react";
import { useOrders, useMenu, useRuptures, useDessertStock, usePizzaStock, useSlots, updateOrder, deleteOrders } from "@/lib/data";
import { isOrderActiveToday, sortOrdersByTime } from "@/lib/business";
import OrderCardHeader from "../OrderCardHeader";
import GroupedItemList from "../GroupedItemList";
import EditOrderModal from "./EditOrderModal";

const GROUPS = [
  { key: "pret_service", label: "🟢 Prêtes à apporter" },
  { key: "prete", label: "🟡 En finition" },
  { key: "preparation", label: "🟠 En cuisson" },
  { key: "attente", label: "🔴 Pas encore lancées" },
];

export default function ServiceBoard() {
  const { orders } = useOrders();
  const { menuItems } = useMenu();
  const { ruptures } = useRuptures();
  const { dessertStock } = useDessertStock();
  const { pizzaStock } = usePizzaStock();
  const { slots } = useSlots();
  const [editingOrder, setEditingOrder] = useState(null);
  const active = orders.filter((o) => o.status !== "servie" && isOrderActiveToday(o));
  const aperoReady = active.filter((o) => o.aperoStatus === "served_by_kitchen");

  function launchPizzas(order) {
    updateOrder(order.id, { aperoStatus: "released" }).catch((err) => console.error(err));
  }
  function markDelivered(order) {
    updateOrder(order.id, { delivered: true }).catch((err) => console.error(err));
  }
  function cancelOrder(order) {
    if (!window.confirm(`Annuler définitivement la commande « ${order.name} » ? Cette action est irréversible.`)) return;
    deleteOrders([order.id]).catch((err) => console.error(err));
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {aperoReady.length > 0 && (
        <div className="mb-6">
          <div className="font-bold mb-3">🍸 Apéro servi — prêt à lancer les pizzas ({aperoReady.length})</div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {sortOrdersByTime(aperoReady).map((o) => (
              <div key={o.id} className="w-72 shrink-0 rounded-xl border-2 p-4" style={{ borderColor: "#C0392B", background: "#2c1c14" }}>
                <OrderCardHeader order={o} onDelete={() => cancelOrder(o)} />
                <div className="display-font text-lg font-bold mb-2">{o.name}</div>
                <GroupedItemList items={o.items.filter((it) => it.phase === "main")} className="mb-3" />
                <button onClick={() => launchPizzas(o)} className="tap-scale w-full rounded-xl py-4 text-lg font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
                  🍕 Lancer les pizzas
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {GROUPS.map((g) => {
        const list = active.filter((o) => o.status === g.key && !(g.key === "pret_service" && o.delivered));
        if (list.length === 0) return null;
        return (
          <div key={g.key} className="mb-6">
            <div className="font-bold mb-3">
              {g.label} ({list.length})
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {sortOrdersByTime(list).map((o) => (
                <div key={o.id} className="w-72 shrink-0 rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
                  <OrderCardHeader order={o} onEdit={() => setEditingOrder(o)} onDelete={() => cancelOrder(o)} />
                  <div className="display-font text-lg font-bold mb-2">{o.name}</div>
                  <GroupedItemList items={o.items} className="mb-3" />
                  {g.key === "pret_service" && (
                    <button onClick={() => markDelivered(o)} className="tap-scale w-full rounded-xl py-3 text-sm font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
                      ✅ Partie
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

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
