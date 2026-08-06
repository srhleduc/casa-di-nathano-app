"use client";

import { useEffect, useState } from "react";
import { formatStopwatch } from "@/lib/business";

// Chrono discret : petit texte gris qui défile seconde par seconde tant que
// l'étape n'est pas terminée. Pas de couleur d'urgence, pas de décompte —
// juste un repère, pas un outil de pression sur l'équipe.
export default function ElapsedBadge({ since, until }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [until]);

  if (!since) return null;
  const elapsed = Math.max(0, (until || now) - since);

  return (
    <span className="text-xs text-[#8a7561] font-semibold tabular-nums" title="Temps écoulé depuis l'envoi de cette étape">
      ⏱ {formatStopwatch(elapsed)}
    </span>
  );
}
