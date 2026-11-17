"use client";

// Écran équipe « Livraisons » : suit chaque commande livrée par l'équipe, de la
// préparation jusqu'à la remise au client. Le statut de livraison
// (orders.delivery_status) est indépendant du statut cuisine : la cuisine
// continue de passer par Four / Finition comme pour un « à emporter », et la
// commande n'apparaît dans « Prêtes à livrer » qu'une fois sortie de Finition.
//
// L'encaissement reste en Caisse (paiement au livreur à la livraison : le
// livreur rapporte l'argent, la caissière valide comme d'habitude).

import { useState } from "react";
import { useOrders, useMenu, useRuptures, useDessertStock, usePizzaStock, useSlots, updateOrder, deleteOrders } from "@/lib/data";
import { sortOrdersByTime, isOrderPaid, isOrderActiveToday } from "@/lib/business";
import { eur } from "@/lib/menu";
import OrderCardHeader from "../OrderCardHeader";
import OrderNote from "../OrderNote";
import GroupedItemList from "../GroupedItemList";
import ElapsedBadge from "../ElapsedBadge";
import EditOrderModal from "./EditOrderModal";

// Statuts cuisine « pas encore sorti de Finition ».
const KITCHEN_PENDING = ["attente", "preparation", "prete"];

function mapsUrl(o) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.deliveryAddress || "")}`;
}
function telUrl(phone) {
  return `tel:${(phone || "").replace(/[\s.\-()]/g, "")}`;
}

function DeliveryCard({ order, onEdit, onDelete, children }) {
  const paid = isOrderPaid(order);
  return (
    <div className="w-80 shrink-0 rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
      <OrderCardHeader order={order} onEdit={onEdit} onDelete={onDelete} />
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="display-font text-xl font-bold">{order.name}</div>
        <ElapsedBadge since={order.createdAt} />
      </div>

      <div className="rounded-lg px-3 py-3 mb-3" style={{ background: "#1c3a52" }}>
        <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#9fd0f5" }}>
          📍 Adresse
        </div>
        <div className="font-bold text-[#f5ebdd] leading-snug">{order.deliveryAddress}</div>
        {order.deliveryInstructions && <div className="text-sm mt-1" style={{ color: "#cfe6fa" }}>ℹ️ {order.deliveryInstructions}</div>}
        {order.deliveryDistanceKm != null && <div className="text-xs mt-1" style={{ color: "#9fd0f5" }}>≈ {order.deliveryDistanceKm.toLocaleString("fr-FR")} km</div>}
        <div className="flex gap-2 mt-3">
          <a href={mapsUrl(order)} target="_blank" rel="noopener noreferrer" className="tap-scale flex-1 text-center rounded-lg py-2 text-sm font-bold" style={{ background: "#2b5a82", color: "#fff" }}>
            🗺️ Itinéraire
          </a>
          {order.deliveryPhone && (
            <a href={telUrl(order.deliveryPhone)} className="tap-scale flex-1 text-center rounded-lg py-2 text-sm font-bold" style={{ background: "#2b5a82", color: "#fff" }}>
              📞 {order.deliveryPhone}
            </a>
          )}
        </div>
      </div>

      <GroupedItemList items={order.items} className="mb-3" />
      <OrderNote note={order.note} />

      <div className="flex items-center justify-between text-sm mb-3 mt-2">
        <span className="text-[#a88f78]">{paid ? "💰 Déjà payée" : "À encaisser"}</span>
        <span className="font-bold text-[#E8B23D]">
          {eur(order.total)}
          {order.deliveryFee > 0 && <span className="text-xs font-normal text-[#a88f78]"> (dont livraison {eur(order.deliveryFee)})</span>}
        </span>
      </div>
      {children}
    </div>
  );
}

export default function DeliveryBoard({ readOnly }) {
  const { orders } = useOrders();
  const { menuItems } = useMenu();
  const { ruptures } = useRuptures();
  const { dessertStock } = useDessertStock();
  const { pizzaStock } = usePizzaStock();
  const { slots } = useSlots();
  const [editingOrder, setEditingOrder] = useState(null);

  const deliveries = orders.filter((o) => o.deliveryStatus && o.deliveryStatus !== "annulee" && isOrderActiveToday(o));
  const kitchenPending = deliveries.filter((o) => o.deliveryStatus === "a_livrer" && KITCHEN_PENDING.includes(o.status));
  const ready = deliveries.filter((o) => o.deliveryStatus === "a_livrer" && !KITCHEN_PENDING.includes(o.status));
  const enRoute = deliveries.filter((o) => o.deliveryStatus === "en_route");
  const done = deliveries.filter((o) => o.deliveryStatus === "livree");

  function startDelivery(o) {
    updateOrder(o.id, { deliveryStatus: "en_route", deliveryStartedAt: new Date().toISOString() }).catch((err) => console.error(err));
  }
  function backToReady(o) {
    updateOrder(o.id, { deliveryStatus: "a_livrer", deliveryStartedAt: null }).catch((err) => console.error(err));
  }
  function markDelivered(o) {
    updateOrder(o.id, { deliveryStatus: "livree", deliveredAt: new Date().toISOString() }).catch((err) => console.error(err));
  }
  function backToRoute(o) {
    updateOrder(o.id, { deliveryStatus: "en_route", deliveredAt: null }).catch((err) => console.error(err));
  }
  function cancelOrder(o) {
    if (!window.confirm(`Annuler définitivement la livraison « ${o.name} » ? Cette action est irréversible.`)) return;
    deleteOrders([o.id]).catch((err) => console.error(err));
  }

  const section = (title, list, render) =>
    list.length > 0 && (
      <div className="mb-6">
        <div className="font-bold mb-3">
          {title} ({list.length})
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2">{sortOrdersByTime(list).map(render)}</div>
      </div>
    );

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <p className="text-[#a88f78] mb-4 text-sm">Commandes à livrer. Le règlement se fait auprès du livreur ; la caissière valide l&apos;encaissement en Caisse.</p>
      {deliveries.length === 0 && <p className="text-[#8a7561]">Aucune livraison pour l&apos;instant.</p>}

      {section("🟢 Prêtes à livrer", ready, (o) => (
        <DeliveryCard key={o.id} order={o} onEdit={readOnly ? undefined : () => setEditingOrder(o)} onDelete={readOnly ? undefined : () => cancelOrder(o)}>
          {!readOnly && (
            <button onClick={() => startDelivery(o)} className="tap-scale w-full rounded-xl py-4 text-lg font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
              🛵 Je pars livrer
            </button>
          )}
        </DeliveryCard>
      ))}

      {section("🛵 En route", enRoute, (o) => (
        <DeliveryCard key={o.id} order={o} onEdit={readOnly ? undefined : () => setEditingOrder(o)} onDelete={readOnly ? undefined : () => cancelOrder(o)}>
          {!readOnly && (
            <>
              <button onClick={() => markDelivered(o)} className="tap-scale w-full rounded-xl py-4 text-lg font-bold" style={{ background: "#204a3a", color: "#a8e8c8" }}>
                ✅ Livrée
              </button>
              <button onClick={() => backToReady(o)} className="tap-scale w-full mt-2 text-sm font-semibold text-[#a88f78]">
                ↩ Remettre dans « Prêtes à livrer »
              </button>
            </>
          )}
        </DeliveryCard>
      ))}

      {section("🔴 En préparation", kitchenPending, (o) => (
        <DeliveryCard key={o.id} order={o} onEdit={readOnly ? undefined : () => setEditingOrder(o)} onDelete={readOnly ? undefined : () => cancelOrder(o)}>
          <div className="text-center text-sm text-[#a88f78]">En cuisine — elle passera dans « Prêtes à livrer » à la sortie de Finition.</div>
        </DeliveryCard>
      ))}

      {section("✅ Livrées aujourd'hui", done, (o) => (
        <DeliveryCard key={o.id} order={o} onEdit={readOnly ? undefined : () => setEditingOrder(o)}>
          {!isOrderPaid(o) && <div className="text-center text-sm font-bold mb-2" style={{ color: "#E8B23D" }}>💰 À encaisser en Caisse</div>}
          {!readOnly && (
            <button onClick={() => backToRoute(o)} className="tap-scale w-full text-sm font-semibold text-[#a88f78]">
              ↩ Remettre « En route »
            </button>
          )}
        </DeliveryCard>
      ))}

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
