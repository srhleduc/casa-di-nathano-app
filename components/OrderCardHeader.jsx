"use client";

export default function OrderCardHeader({ order }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span
        className="text-xs font-bold rounded-full px-3 py-1"
        style={
          order.serviceType === "🍽️ Sur place"
            ? { background: "#2c3e50", color: "#a8c8e8" }
            : { background: "#4a2c3e", color: "#e8a8c8" }
        }
      >
        {order.serviceType}
      </span>
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
