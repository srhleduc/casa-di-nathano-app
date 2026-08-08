"use client";

import { useOrders, deleteOrders } from "@/lib/data";
import { isOrderScheduledLater, formatFrenchDate } from "@/lib/business";
import { eur } from "@/lib/menu";
import ItemLine from "../ItemLine";
import OrderCardHeader from "../OrderCardHeader";

export default function ScheduledOrdersList({ onNew }) {
  const { orders } = useOrders();
  const upcoming = orders.filter((o) => o.status !== "servie" && isOrderScheduledLater(o)).sort((a, b) => (a.scheduledFor < b.scheduledFor ? -1 : 1));

  function cancelOrder(order) {
    if (!window.confirm(`Annuler définitivement la commande « ${order.name} » ? Cette action est irréversible.`)) return;
    deleteOrders([order.id]).catch((err) => console.error(err));
  }

  const byDate = {};
  upcoming.forEach((o) => {
    byDate[o.scheduledFor] = byDate[o.scheduledFor] || [];
    byDate[o.scheduledFor].push(o);
  });

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <button onClick={onNew} className="tap-scale w-full rounded-2xl py-5 text-xl font-bold mb-6" style={{ background: "#C0392B", color: "#fff5ea" }}>
        + Nouvelle commande à programmer
      </button>

      {upcoming.length === 0 && <p className="text-[#8a7561]">Aucune commande programmée pour un autre jour.</p>}

      {Object.keys(byDate).map((date) => (
        <div key={date} className="mb-6">
          <div className="font-bold mb-3 capitalize">
            📅 {formatFrenchDate(date)} ({byDate[date].length})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {byDate[date]
              .sort((a, b) => (a.scheduledTime || "").localeCompare(b.scheduledTime || ""))
              .map((o) => (
                <div key={o.id} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
                  <OrderCardHeader order={o} onDelete={() => cancelOrder(o)} />
                  <div className="display-font text-lg font-bold mb-2">{o.name}</div>
                  <ul className="text-sm text-[#c9b8a4]">
                    {o.items.map((it, idx) => (
                      <ItemLine key={idx} it={it} />
                    ))}
                  </ul>
                  <div className="display-font font-bold text-[#E8B23D] mt-2">{eur(o.total)}</div>
                </div>
              ))}
          </div>
        </div>
      ))}
      <p className="text-[#5a4a3a] text-xs mt-4">Ces commandes basculent automatiquement dans les écrans normaux (Four, Finition, Service...) le jour même, sans rien à faire.</p>
    </div>
  );
}
