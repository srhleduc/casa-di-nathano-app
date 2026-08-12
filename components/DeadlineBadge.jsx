"use client";

import { useEffect, useState } from "react";
import { orderDeadlineMinutes, formatStopwatch } from "@/lib/business";

// Chrono du four : blanc et décompte le temps restant avant le créneau visé,
// puis bascule en rouge et décompte le retard accumulé une fois le créneau
// dépassé. Contrairement à ElapsedBadge (discret, sans urgence), celui-ci
// sert justement à repérer une commande qui prend du retard sur le four.
export default function DeadlineBadge({ order }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const deadlineMinutes = orderDeadlineMinutes(order);
  if (deadlineMinutes == null) return null;

  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const targetMs = midnight.getTime() + deadlineMinutes * 60000;
  const diff = targetMs - now;
  const late = diff < 0;

  return (
    <span
      className="text-xs font-bold tabular-nums"
      style={{ color: late ? "#ff4d4d" : "#f5ebdd" }}
      title={late ? "Retard sur le créneau visé" : "Temps restant avant le créneau visé"}
    >
      ⏱ {late ? "+" : ""}
      {formatStopwatch(Math.abs(diff))}
    </span>
  );
}
