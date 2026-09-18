"use client";

import { serviceTypeBadgeStyle, formatSlotAllocations, isOrderPaid } from "@/lib/business";

export default function OrderCardHeader({ order, onEdit, onDelete, showTime = true }) {
  return (
    <div className="flex items-start justify-between mb-2 gap-2 flex-wrap">
      <div className="flex items-center gap-2">
        {order.takeawayNumber != null && (
          <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "var(--color-accent)", color: "var(--color-text-alt)" }}>
            N°{order.takeawayNumber}
          </span>
        )}
        <span className="text-xs font-bold rounded-full px-3 py-1" style={serviceTypeBadgeStyle(order.serviceType)}>
          {order.serviceType}
        </span>
        {isOrderPaid(order) && order.status !== "servie" && (
          <span
            className="text-xs font-bold rounded-full px-3 py-1"
            style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}
            title="Déjà réglée — ne pas encaisser une deuxième fois"
          >
            💰 Déjà payée
          </span>
        )}
        {order.isTest && (
          <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "var(--color-test-surface)", color: "var(--color-test-accent)" }}>
            🧪 TEST
          </span>
        )}
        {Array.isArray(order.items) && order.items.some((it) => it.source) && (
          <span
            className="text-xs font-bold rounded-full px-3 py-1"
            style={{ background: "var(--color-surface-alt)", color: "var(--color-text-muted)" }}
            title="Contient des articles saisis par le client (borne à table ou click & collect)"
          >
            📲
          </span>
        )}
        {order.slotForced && (
          <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "var(--color-danger-alert-bg)", color: "var(--color-danger-strong)" }}>
            ⚠️ Créneau forcé
          </span>
        )}
        {onEdit && (
          <button onClick={onEdit} className="tap-scale text-xs font-bold rounded-full px-3 py-1 border-2" style={{ borderColor: "var(--color-border)" }}>
            ✏️
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {showTime &&
          (order.slotAllocations && order.slotAllocations.length > 0 ? (
            <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "var(--color-surface-alt)", color: "var(--color-accent-gold)" }}>
              🕐 {formatSlotAllocations(order.slotAllocations)}
            </span>
          ) : order.scheduledTime ? (
            <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "var(--color-surface-alt)", color: "var(--color-accent-gold)" }}>
              🕐 {order.scheduledTime}
            </span>
          ) : null)}
        {onDelete && (
          <button
            onClick={onDelete}
            aria-label="Annuler la commande"
            className="tap-scale w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
