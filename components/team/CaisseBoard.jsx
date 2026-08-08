"use client";

import { useState } from "react";
import { useOrders, useMenu, useRuptures, useDessertStock, usePizzaStock, useSlots, updateOrder, deleteOrders, useTakeawayLinkStatus, setTakeawayLinkSuspended } from "@/lib/data";
import { isOrderActiveToday, sortOrdersByTime, sortKitchenQueue, sortItemsForDisplay, TAKEAWAY_SERVICE_TYPE } from "@/lib/business";
import { eur } from "@/lib/menu";
import ItemLine from "../ItemLine";
import OrderCardHeader from "../OrderCardHeader";
import EditOrderModal from "./EditOrderModal";

export default function CaisseBoard() {
  const { orders } = useOrders();
  const { menuItems } = useMenu();
  const { ruptures } = useRuptures();
  const { dessertStock } = useDessertStock();
  const { pizzaStock } = usePizzaStock();
  const { slots } = useSlots();
  const [editingOrder, setEditingOrder] = useState(null);
  const active = orders.filter((o) => o.status !== "servie" && isOrderActiveToday(o));
  const paidToday = orders.filter((o) => o.status === "servie" && isOrderActiveToday(o));
  // Le chiffre du jour n'inclut jamais les commandes du mode test.
  const realActive = active.filter((o) => !o.isTest);
  const realPaidToday = paidToday.filter((o) => !o.isTest);
  const totalActive = realActive.reduce((s, o) => s + o.total, 0);
  const totalCollected = realPaidToday.reduce((s, o) => s + o.total, 0);

  const [cancelMode, setCancelMode] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);
  const { suspended } = useTakeawayLinkStatus();

  function toggleTakeawayLink() {
    setTakeawayLinkSuspended(!suspended).catch((err) => console.error(err));
  }

  function markPaid(order) {
    updateOrder(order.id, { status: "servie" }).catch((err) => console.error(err));
  }

  function cancelOrder(order) {
    deleteOrders([order.id]).catch((err) => console.error(err));
    setConfirmingId(null);
  }

  function quickCancel(order) {
    if (!window.confirm(`Annuler définitivement la commande « ${order.name} » ? Cette action est irréversible.`)) return;
    deleteOrders([order.id]).catch((err) => console.error(err));
  }

  const cancellable = sortOrdersByTime([...active, ...paidToday]);
  const activeQueue = sortKitchenQueue(active);
  const activeTakeaway = activeQueue.filter((o) => o.serviceType === TAKEAWAY_SERVICE_TYPE);
  const activeDineIn = activeQueue.filter((o) => o.serviceType !== TAKEAWAY_SERVICE_TYPE);

  function renderActiveCard(o) {
    return (
      <div key={o.id} className="w-72 shrink-0 rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
        <OrderCardHeader order={o} onEdit={() => setEditingOrder(o)} onDelete={() => quickCancel(o)} />
        <div className="display-font text-lg font-bold mb-2">{o.name}</div>
        <ul className="text-sm text-[#c9b8a4] mb-3">
          {sortItemsForDisplay(o.items).map((it, idx) => (
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
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="flex gap-4 mb-4">
        <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] px-5 py-4 flex-1">
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">À encaisser ({realActive.length})</div>
          <div className="display-font text-2xl font-bold">{eur(totalActive)}</div>
        </div>
        <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] px-5 py-4 flex-1">
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Déjà encaissé ({realPaidToday.length})</div>
          <div className="display-font text-2xl font-bold text-[#E8B23D]">{eur(totalCollected)}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => {
            setCancelMode(!cancelMode);
            setConfirmingId(null);
          }}
          className="tap-scale rounded-full px-5 py-3 text-sm font-bold border-2"
          style={cancelMode ? { borderColor: "#C0392B", background: "#2c1c14" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
        >
          {cancelMode ? "← Retour à la caisse" : "🗑️ Annuler une commande"}
        </button>
        <button
          onClick={toggleTakeawayLink}
          className="tap-scale rounded-full px-5 py-3 text-sm font-bold border-2"
          style={suspended ? { borderColor: "#C0392B", background: "#2c1c14", color: "#e88a8a" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
        >
          {suspended ? "▶️ Réactiver le click and collect" : "⏸️ Suspendre le click and collect"}
        </button>
      </div>
      {suspended && (
        <div className="rounded-2xl px-5 py-3 mb-6 text-sm font-bold" style={{ background: "#2c1c14", border: "1px solid #C0392B", color: "#e88a8a" }}>
          ⏸️ Le lien de commande en ligne (/commande) est actuellement suspendu — les clients qui scannent le QR code voient un message les
          invitant à appeler.
        </div>
      )}

      {cancelMode ? (
        <>
          <p className="text-[#a88f78] text-sm mb-4">
            Sélectionne la commande à annuler — elle sera supprimée définitivement, y compris de "Déjà encaissé" si elle
            était payée.
          </p>
          {cancellable.length === 0 && <p className="text-[#8a7561]">Aucune commande aujourd'hui.</p>}
          <div className="flex flex-wrap gap-3">
            {cancellable.map((o) => (
              <div key={o.id} className="w-72 shrink-0 rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
                <OrderCardHeader order={o} />
                <div className="display-font text-lg font-bold mb-1">{o.name}</div>
                <div className="text-xs text-[#a88f78] mb-3">{o.status === "servie" ? "💰 Déjà encaissée" : "⏳ En attente de règlement"}</div>
                <div className="flex items-center justify-between">
                  <span className="display-font font-bold text-[#E8B23D] text-lg">{eur(o.total)}</span>
                  {confirmingId === o.id ? (
                    <button onClick={() => cancelOrder(o)} className="tap-scale text-xs font-bold rounded-full px-4 py-2" style={{ background: "#C0392B", color: "#fff5ea" }}>
                      Confirmer ?
                    </button>
                  ) : (
                    <button onClick={() => setConfirmingId(o.id)} className="tap-scale text-xs font-bold rounded-full px-4 py-2 border-2 border-red-800 text-red-400">
                      🗑️ Annuler
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {active.length === 0 && <p className="text-[#8a7561]">Aucune commande en attente de règlement.</p>}
          {active.length > 0 && (
            <>
              <div className="font-bold mb-3">🥡 À emporter ({activeTakeaway.length})</div>
              <div className="flex gap-4 overflow-x-auto pb-2 mb-6">
                {activeTakeaway.map(renderActiveCard)}
                {activeTakeaway.length === 0 && <p className="text-[#8a7561]">Aucune pour l'instant.</p>}
              </div>

              <div className="font-bold mb-3">🍽️ Sur place ({activeDineIn.length})</div>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {activeDineIn.map(renderActiveCard)}
                {activeDineIn.length === 0 && <p className="text-[#8a7561]">Aucune pour l'instant.</p>}
              </div>
            </>
          )}
        </>
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
