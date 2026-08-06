"use client";

import { useOrders, updateOrder } from "@/lib/data";
import { isOrderActiveToday, sortOrdersByTime } from "@/lib/business";
import ItemLine from "../ItemLine";
import OrderCardHeader from "../OrderCardHeader";

export default function FinitionBoard() {
  const { orders } = useOrders();
  const active = orders.filter((o) => o.status !== "servie" && isOrderActiveToday(o));
  // Concerné par Finition : les planches/salades (dès la prise de commande) ET les commandes
  // qui viennent de sortir du four (garniture après-cuisson) ou qui n'ont pas de pizza du tout.
  const toHandle = active.filter((o) => {
    const hasPrep = o.items.some((it) => it.cat === "antipasti" || it.cat === "salade");
    const needsGarnish = o.status === "prete";
    const noPizzaAtAll = o.pizzaCount === 0 && o.status !== "pret_service";
    return hasPrep || needsGarnish || noPizzaAtAll;
  });

  function markDone(order) {
    updateOrder(order.id, { status: "pret_service" }).catch((err) => console.error(err));
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <p className="text-[#a88f78] mb-4 text-sm">Planches, salades et garniture après-cuisson des pizzas — dès qu'elles sortent du four.</p>
      {toHandle.length === 0 && <p className="text-[#8a7561]">Rien à préparer pour l'instant.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sortOrdersByTime(toHandle).map((o) => {
          const prepItems = o.items.filter((it) => it.cat === "antipasti" || it.cat === "salade");
          const canFinish = o.status === "prete" || o.pizzaCount === 0;
          return (
            <div key={o.id} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
              <OrderCardHeader order={o} />
              <div className="display-font text-lg font-bold mb-2">{o.name}</div>
              {prepItems.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Planches / salades</div>
                  <ul className="text-sm text-[#c9b8a4]">
                    {prepItems.map((it, idx) => (
                      <ItemLine key={idx} it={it} />
                    ))}
                  </ul>
                </div>
              )}
              {o.status === "prete" && (
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
              {canFinish && (
                <button onClick={() => markDone(o)} className="tap-scale w-full rounded-xl py-3 text-sm font-bold mt-2" style={{ background: "#C0392B", color: "#fff5ea" }}>
                  ✅ Terminé → Service
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
