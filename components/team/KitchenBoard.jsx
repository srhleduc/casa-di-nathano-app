"use client";

import { useOrders, updateOrder } from "@/lib/data";
import { isOrderActiveToday, sortOrdersByTime } from "@/lib/business";
import { eur } from "@/lib/menu";
import ItemLine from "../ItemLine";

const COLS = [
  { key: "attente", label: "🔴 En attente" },
  { key: "preparation", label: "🟠 Enfournée" },
];

export default function KitchenBoard() {
  const { orders } = useOrders();
  const active = orders.filter((o) => o.status !== "servie" && isOrderActiveToday(o));
  const aperoWaiting = active.filter((o) => o.aperoStatus === "waiting");

  function advance(order) {
    const next = order.status === "attente" ? "preparation" : "prete";
    updateOrder(order.id, { status: next }).catch((err) => console.error(err));
  }
  function markAperoServed(order) {
    updateOrder(order.id, { aperoStatus: "served_by_kitchen" }).catch((err) => console.error(err));
  }

  // Une commande normale (colonnes En attente / Enfournée) doit avoir des pizzas "hors apéro" à faire,
  // et ne pas être en train d'attendre son apéro.
  function normalPizzaItems(o) {
    return o.items.filter((it) => (it.cat === "pizza" || it.cat === "supplement" || it.cat === "sans") && it.phase !== "apero");
  }
  function isNormalQueueOrder(o) {
    return !["waiting", "served_by_kitchen"].includes(o.aperoStatus) && normalPizzaItems(o).length > 0;
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {aperoWaiting.length > 0 && (
        <div className="mb-6">
          <div className="font-bold mb-3">🍸 Apéro à préparer ({aperoWaiting.length})</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sortOrdersByTime(aperoWaiting).map((o) => {
              const aperoItems = o.items.filter((it) => (it.cat === "pizza" || it.cat === "supplement" || it.cat === "sans") && it.phase === "apero");
              return (
                <div key={o.id} className="rounded-xl border-2 p-4" style={{ borderColor: "#C0392B", background: "#2c1c14" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "#4a2c14", color: "#E8B23D" }}>
                      ⏳ Attente apéro
                    </span>
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

      <div className="flex gap-4">
        {COLS.map((c) => {
          const list = sortOrdersByTime(active.filter((o) => o.status === c.key && isNormalQueueOrder(o)));
          return (
            <div key={c.key} className="min-w-[280px] flex-1">
              <div className="font-bold mb-3">
                {c.label} ({list.length})
              </div>
              <div className="flex flex-col gap-3">
                {list.map((o) => (
                  <div key={o.id} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="text-xs font-bold rounded-full px-3 py-1"
                        style={o.serviceType === "🍽️ Sur place" ? { background: "#2c3e50", color: "#a8c8e8" } : { background: "#4a2c3e", color: "#e8a8c8" }}
                      >
                        {o.serviceType}
                      </span>
                      {o.slotAllocations && o.slotAllocations.length > 0 && (
                        <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "#2c1c14", color: "#E8B23D" }}>
                          🕐 {o.slotAllocations.map((a) => `${a.qty}×${a.label}`).join(" + ")}
                        </span>
                      )}
                    </div>
                    <div className="display-font text-xl font-bold mb-2">{o.name}</div>
                    <ul className="text-sm text-[#c9b8a4] mb-3">
                      {normalPizzaItems(o).map((it, idx) => (
                        <ItemLine key={idx} it={it} />
                      ))}
                    </ul>
                    <div className="display-font font-bold text-[#E8B23D] mb-3">{eur(o.total)}</div>
                    {o.status !== "prete" && (
                      <button onClick={() => advance(o)} className="tap-scale w-full rounded-xl py-4 text-lg font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
                        {o.status === "attente" ? "🔥 Enfourner" : "✅ Sortie du four"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
