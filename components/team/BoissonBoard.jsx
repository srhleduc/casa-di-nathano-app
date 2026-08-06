"use client";

import { useOrders } from "@/lib/data";
import { isOrderActiveToday, sortOrdersByTime } from "@/lib/business";
import ItemLine from "../ItemLine";
import OrderCardHeader from "../OrderCardHeader";

const DRINK_CATS = ["boisson", "biere", "vin", "cocktail"];

export default function BoissonBoard() {
  const { orders } = useOrders();
  const active = orders.filter((o) => o.status !== "servie" && isOrderActiveToday(o));
  const withDrinks = active
    .map((o) => ({ ...o, drinkItems: o.items.filter((it) => DRINK_CATS.includes(it.cat)) }))
    .filter((o) => o.drinkItems.length > 0);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <p className="text-[#a88f78] mb-4 text-sm">Boissons, bières, vins et cocktails à préparer — indépendamment de l'avancée du four. Pratique un soir de concert.</p>
      {withDrinks.length === 0 && <p className="text-[#8a7561]">Rien à préparer pour l'instant.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sortOrdersByTime(withDrinks).map((o) => (
          <div key={o.id} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
            <OrderCardHeader order={o} />
            <div className="display-font text-lg font-bold mb-2">{o.name}</div>
            <ul className="text-sm text-[#c9b8a4]">
              {o.drinkItems.map((it, idx) => (
                <ItemLine key={idx} it={it} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
