"use client";

import { useState } from "react";
import { useOrders, useMenu, useRuptures, useDessertStock, usePizzaStock, useSlots, updateOrder, deleteOrders } from "@/lib/data";
import { isOrderActiveToday, sortOrdersByTime, sortByTableName, isTakeawayLike } from "@/lib/business";
import OrderCardHeader from "../OrderCardHeader";
import OrderNote from "../OrderNote";
import GroupedItemList from "../GroupedItemList";
import EditOrderModal from "./EditOrderModal";

const GROUPS = [
  { key: "pret_service", label: "🟢 Prêtes à apporter" },
  { key: "prete", label: "🟡 En finition" },
  { key: "preparation", label: "🟠 En cuisson" },
  { key: "attente", label: "🔴 Pas encore lancées" },
];

function statusDot(o) {
  if (o.aperoStatus === "served_by_kitchen") return "🍸";
  if (o.status === "pret_service") return "🟢";
  if (o.status === "prete") return "🟡";
  if (o.status === "preparation") return "🟠";
  return "🔴";
}

export default function ServiceBoard() {
  const { orders } = useOrders();
  const { menuItems } = useMenu();
  const { ruptures } = useRuptures();
  const { dessertStock } = useDessertStock();
  const { pizzaStock } = usePizzaStock();
  const { slots } = useSlots();
  const [editingOrder, setEditingOrder] = useState(null);
  const active = orders.filter((o) => o.status !== "servie" && isOrderActiveToday(o));
  const aperoWaiting = active.filter((o) => o.aperoStatus === "waiting");
  const aperoReady = active.filter((o) => o.aperoStatus === "served_by_kitchen");
  // Pas de bouton "Partie" : une table sur place reste sur l'écran (carte
  // complète, modifiable via ✏️ pour un café tardif…) jusqu'à ce que la
  // caissière valide le règlement — la commande passe alors à "servie" et sort
  // de `active`. Comportement identique dans les deux zones (Écrans équipe /
  // Commandes-Service).
  const dineInActive = active.filter((o) => !isTakeawayLike(o.serviceType));
  // Un ajout client via /sat n'est "vu" que quand la serveuse a pointé la
  // pastille ET chaque ligne concernée (point rose par article). Tant qu'il
  // reste quelque chose de non pointé, la table passe tout devant.
  const isFlagged = (o) => Boolean(o.satAdditionAt) || (o.items || []).some((it) => it.satNew);
  const tablePills = [
    ...sortByTableName(dineInActive.filter(isFlagged)),
    ...sortByTableName(dineInActive.filter((o) => !isFlagged(o))),
  ];

  function scrollToOrder(id) {
    document.getElementById(`order-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }
  function openPill(o) {
    scrollToOrder(o.id);
    if (o.satAdditionAt) updateOrder(o.id, { satAdditionAt: null }).catch((err) => console.error(err));
  }
  // Point rose d'une ligne pointée par la serveuse (clic sur le point ou la
  // ligne). Quand plus aucune ligne n'est en attente, on efface aussi le
  // signal au niveau commande (pastille).
  function ackSatItem(order, targetItem) {
    const updatedItems = order.items.map((it) => (it === targetItem ? { ...it, satNew: false } : it));
    const patch = { items: updatedItems };
    if (order.satAdditionAt && !updatedItems.some((it) => it.satNew)) patch.satAdditionAt = null;
    updateOrder(order.id, patch).catch((err) => console.error(err));
  }

  function launchPizzas(order) {
    updateOrder(order.id, { aperoStatus: "released" }).catch((err) => console.error(err));
  }
  // Confirmation d'apéro apporté à table — du ressort du service, qui voit
  // physiquement les boissons arriver, plutôt que du pizzaiolo (écran Four),
  // qui n'a rien à surveiller quand l'apéro ne comporte que des boissons.
  function markAperoServed(order) {
    const updatedItems = order.items.map((it) =>
      (it.cat === "pizza" || it.cat === "supplement" || it.cat === "sans") && it.phase === "apero" && !it.served ? { ...it, served: true } : it
    );
    updateOrder(order.id, { aperoStatus: "served_by_kitchen", items: updatedItems }).catch((err) => console.error(err));
  }
  function cancelOrder(order) {
    if (!window.confirm(`Annuler définitivement la commande « ${order.name} » ? Cette action est irréversible.`)) return;
    deleteOrders([order.id]).catch((err) => console.error(err));
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {tablePills.length > 0 && (
        <div className="sticky top-0 z-20 -mx-6 px-6 pt-1 pb-3 mb-3" style={{ background: "#140d08" }}>
          <div className="flex gap-2 overflow-x-auto">
            {tablePills.map((o) => {
              const flagged = isFlagged(o);
              return (
                <button
                  key={o.id}
                  onClick={() => openPill(o)}
                  className="tap-scale shrink-0 flex items-center gap-2 rounded-full px-4 py-2 border-2 bg-[#211712] font-bold"
                  style={
                    flagged
                      ? { borderColor: "#ff2d95", boxShadow: "0 0 10px rgba(255,45,149,0.55)" }
                      : { borderColor: "#3a2b1f" }
                  }
                >
                  {flagged && (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: "#ff2d95", boxShadow: "0 0 6px #ff2d95" }}
                      aria-label="Ajout client"
                    />
                  )}
                  <span>{statusDot(o)}</span>
                  <span>{o.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {aperoWaiting.length > 0 && (
        <div className="mb-6">
          <div className="font-bold mb-3">🍸 Apéro à servir ({aperoWaiting.length})</div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {sortOrdersByTime(aperoWaiting).map((o) => (
              <div key={o.id} id={`order-${o.id}`} className="w-72 shrink-0 rounded-xl border-2 p-4" style={{ borderColor: "#C0392B", background: "#2c1c14" }}>
                <OrderCardHeader order={o} onEdit={() => setEditingOrder(o)} onDelete={() => cancelOrder(o)} />
                <div className="display-font text-lg font-bold mb-2">{o.name}</div>
                <GroupedItemList items={o.items.filter((it) => it.phase === "apero")} className="mb-3" onAckItem={(it) => ackSatItem(o, it)} />
                <button onClick={() => markAperoServed(o)} className="tap-scale w-full rounded-xl py-4 text-lg font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
                  ✅ Apéro servi
                </button>
                <OrderNote note={o.note} />
              </div>
            ))}
          </div>
        </div>
      )}

      {aperoReady.length > 0 && (
        <div className="mb-6">
          <div className="font-bold mb-3">🍸 Apéro servi ({aperoReady.length})</div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {sortOrdersByTime(aperoReady).map((o) => {
              const hasMainFood = o.items.some((it) => (it.cat === "pizza" || it.cat === "panuzzo" || it.cat === "salade") && it.phase !== "apero");
              return (
                <div key={o.id} id={`order-${o.id}`} className="w-72 shrink-0 rounded-xl border-2 p-4" style={{ borderColor: "#C0392B", background: "#2c1c14" }}>
                  <OrderCardHeader order={o} onEdit={() => setEditingOrder(o)} onDelete={() => cancelOrder(o)} />
                  <div className="display-font text-lg font-bold mb-2">{o.name}</div>
                  <GroupedItemList items={o.items.filter((it) => it.phase === "main")} className="mb-3" onAckItem={(it) => ackSatItem(o, it)} />
                  {hasMainFood ? (
                    <button onClick={() => launchPizzas(o)} className="tap-scale w-full rounded-xl py-4 text-lg font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
                      🍕 Lancer les pizzas
                    </button>
                  ) : (
                    <button onClick={() => setEditingOrder(o)} className="tap-scale w-full rounded-xl py-4 text-lg font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
                      🍕 Compléter ma commande
                    </button>
                  )}
                  <OrderNote note={o.note} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {GROUPS.map((g) => {
        const list = active.filter((o) => o.status === g.key);
        if (list.length === 0) return null;
        return (
          <div key={g.key} className="mb-6">
            <div className="font-bold mb-3">
              {g.label} ({list.length})
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {sortOrdersByTime(list).map((o) => (
                <div key={o.id} id={`order-${o.id}`} className="w-72 shrink-0 rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
                  <OrderCardHeader order={o} onEdit={() => setEditingOrder(o)} onDelete={() => cancelOrder(o)} />
                  <div className="display-font text-lg font-bold mb-2">{o.name}</div>
                  <GroupedItemList items={o.items} className="mb-3" onAckItem={(it) => ackSatItem(o, it)} />
                  <OrderNote note={o.note} />
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
