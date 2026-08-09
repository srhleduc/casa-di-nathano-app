"use client";

import { useState } from "react";
import { useOrders, useMenu, useRuptures, useDessertStock, usePizzaStock, useSlots, updateOrder, deleteOrders } from "@/lib/data";
import { isOrderActiveToday, sortOrdersByTime } from "@/lib/business";
import ItemLine from "../ItemLine";
import OrderCardHeader from "../OrderCardHeader";
import EditOrderModal from "./EditOrderModal";

const DRINK_CATS = ["boisson", "biere", "vin", "cocktail", "cafe"];

export default function BoissonBoard() {
  const { orders } = useOrders();
  const { menuItems } = useMenu();
  const { ruptures } = useRuptures();
  const { dessertStock } = useDessertStock();
  const { pizzaStock } = usePizzaStock();
  const { slots } = useSlots();
  const [editingOrder, setEditingOrder] = useState(null);
  const active = orders.filter((o) => o.status !== "servie" && isOrderActiveToday(o));
  // Le statut "servi" se marque par article, pas par commande — si de
  // nouvelles boissons sont ajoutées après un premier "Servie", seules elles
  // doivent réapparaître ici (ex. apéro déjà servi, boissons ajoutées ensuite).
  const withDrinks = active
    .map((o) => ({ ...o, drinkItems: o.items.filter((it) => DRINK_CATS.includes(it.cat) && !it.served) }))
    .filter((o) => o.drinkItems.length > 0);

  function markDrinksServed(order) {
    const updatedItems = order.items.map((it) => (DRINK_CATS.includes(it.cat) && !it.served ? { ...it, served: true } : it));
    updateOrder(order.id, { items: updatedItems }).catch((err) => console.error(err));
  }
  function cancelOrder(order) {
    if (!window.confirm(`Annuler définitivement la commande « ${order.name} » ? Cette action est irréversible.`)) return;
    deleteOrders([order.id]).catch((err) => console.error(err));
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <p className="text-[#a88f78] mb-4 text-sm">Boissons, bières, vins et cocktails à préparer — indépendamment de l'avancée du four. Pratique un soir de concert.</p>
      {withDrinks.length === 0 && <p className="text-[#8a7561]">Rien à préparer pour l'instant.</p>}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {sortOrdersByTime(withDrinks).map((o) => (
          <div key={o.id} className="w-72 shrink-0 rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
            <OrderCardHeader order={o} onEdit={() => setEditingOrder(o)} onDelete={() => cancelOrder(o)} />
            <div className="display-font text-lg font-bold mb-2">{o.name}</div>
            <ul className="text-sm text-[#c9b8a4] mb-3">
              {o.drinkItems.map((it, idx) => (
                <ItemLine key={idx} it={it} />
              ))}
            </ul>
            <button onClick={() => markDrinksServed(o)} className="tap-scale w-full rounded-xl py-3 text-sm font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
              ✅ Servie
            </button>
          </div>
        ))}
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
