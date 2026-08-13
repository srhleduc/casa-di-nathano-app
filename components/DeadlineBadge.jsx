"use client";

import { useEffect, useState } from "react";
import { orderDeadlineMinutes, formatStopwatch } from "@/lib/business";

const SLOT_DURATION_MS = 10 * 60000;

// Chrono du four : blanc et décompte le temps restant avant le créneau visé,
// puis passe en vert une fois entré dans le créneau de 10 min, puis bascule
// en rouge et décompte le retard accumulé une fois le créneau dépassé.
// Contrairement à ElapsedBadge (discret, sans urgence), celui-ci sert
// justement à repérer une commande qui prend du retard sur le four.
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
  const inSlot = !late && diff <= SLOT_DURATION_MS;

  const color = late ? "#ff4d4d" : inSlot ? "#4ade80" : "#f5ebdd";
  const title = late
    ? "Retard sur le créneau visé"
    : inSlot
    ? "Créneau en cours"
    : "Temps restant avant le créneau visé";

  return (
    <span className="text-xs font-bold tabular-nums" style={{ color }} title={title}>
      ⏱ {late ? "+" : ""}
      {formatStopwatch(Math.abs(diff))}
    </span>
  );
}
