"use client";

import { serviceTypeBadgeStyle, formatSlotAllocations } from "@/lib/business";

export default function OrderCardHeader({ order, onEdit, onDelete, showTime = true }) {
  return (
    <div className="flex items-start justify-between mb-2 gap-2 flex-wrap">
      <div className="flex items-center gap-2">
        {order.takeawayNumber != null && (
          <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "#C0392B", color: "#fff5ea" }}>
            N°{order.takeawayNumber}
          </span>
        )}
        <span className="text-xs font-bold rounded-full px-3 py-1" style={serviceTypeBadgeStyle(order.serviceType)}>
          {order.serviceType}
        </span>
        {order.isTest && (
          <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "#4a3a10", color: "#f0c860" }}>
            🧪 TEST
          </span>
        )}
        {Array.isArray(order.items) && order.items.some((it) => it.source) && (
          <span
            className="text-xs font-bold rounded-full px-3 py-1"
            style={{ background: "#2c1c14", color: "#a88f78" }}
            title="Contient des articles saisis par le client (borne à table ou click & collect)"
          >
            📲
          </span>
        )}
        {order.slotForced && (
          <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "#4a1c1c", color: "#ff6b6b" }}>
            ⚠️ Créneau forcé
          </span>
        )}
        {onEdit && (
          <button onClick={onEdit} className="tap-scale text-xs font-bold rounded-full px-3 py-1 border-2 border-[#3a2b1f]">
            ✏️
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {showTime &&
          (order.slotAllocations && order.slotAllocations.length > 0 ? (
            <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "#2c1c14", color: "#E8B23D" }}>
              🕐 {formatSlotAllocations(order.slotAllocations)}
            </span>
          ) : order.scheduledTime ? (
            <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "#2c1c14", color: "#E8B23D" }}>
              🕐 {order.scheduledTime}
            </span>
          ) : null)}
        {onDelete && (
          <button
            onClick={onDelete}
            aria-label="Annuler la commande"
            className="tap-scale w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: "#4a2020", color: "#e88a8a" }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
