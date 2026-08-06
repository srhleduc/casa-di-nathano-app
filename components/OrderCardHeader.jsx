"use client";

import { serviceTypeBadgeStyle } from "@/lib/business";

export default function OrderCardHeader({ order }) {
  return (
    <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold rounded-full px-3 py-1" style={serviceTypeBadgeStyle(order.serviceType)}>
          {order.serviceType}
        </span>
        {order.isTest && (
          <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "#4a3a10", color: "#f0c860" }}>
            🧪 TEST
          </span>
        )}
      </div>
      {order.slotAllocations && order.slotAllocations.length > 0 ? (
        <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "#2c1c14", color: "#E8B23D" }}>
          🕐 {order.slotAllocations.map((a) => `${a.qty}×${a.label}`).join(" + ")}
        </span>
      ) : order.scheduledTime ? (
        <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "#2c1c14", color: "#E8B23D" }}>
          🕐 {order.scheduledTime}
        </span>
      ) : null}
    </div>
  );
}
