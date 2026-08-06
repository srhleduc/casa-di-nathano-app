"use client";

import { useOrders, updateOrder } from "@/lib/data";
import { isOrderActiveToday, sortOrdersByTime } from "@/lib/business";
import { eur } from "@/lib/menu";
import ItemLine from "../ItemLine";
import OrderCardHeader from "../OrderCardHeader";

export default function CaisseBoard() {
  const { orders } = useOrders();
  const active = orders.filter((o) => o.status !== "servie" && isOrderActiveToday(o));
  const paidToday = orders.filter((o) => o.status === "servie" && isOrderActiveToday(o));
  const totalActive = active.reduce((s, o) => s + o.total, 0);
  const totalCollected = paidToday.reduce((s, o) => s + o.total, 0);

  function markPaid(order) {
    updateOrder(order.id, { status: "servie" }).catch((err) => console.error(err));
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="flex gap-4 mb-6">
        <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] px-5 py-4 flex-1">
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">À encaisser ({active.length})</div>
          <div className="display-font text-2xl font-bold">{eur(totalActive)}</div>
        </div>
        <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] px-5 py-4 flex-1">
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Déjà encaissé ({paidToday.length})</div>
          <div className="display-font text-2xl font-bold text-[#E8B23D]">{eur(totalCollected)}</div>
        </div>
      </div>
      {active.length === 0 && <p className="text-[#8a7561]">Aucune commande en attente de règlement.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sortOrdersByTime(active).map((o) => (
          <div key={o.id} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
            <OrderCardHeader order={o} />
            <div className="display-font text-lg font-bold mb-2">{o.name}</div>
            <ul className="text-sm text-[#c9b8a4] mb-3">
              {o.items.map((it, idx) => (
                <ItemLine key={idx} it={it} />
              ))}
            </ul>
            <div className="flex items-center justify-between">
              <span className="display-font font-bold text-[#E8B23D] text-lg">{eur(o.total)}</span>
              <button onClick={() => markPaid(o)} className="tap-scale text-xs font-bold rounded-full px-4 py-2" style={{ background: "#C0392B", color: "#fff5ea" }}>
                💰 Marquer payée
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
