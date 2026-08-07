"use client";

import { useEffect, useState } from "react";

// Horloge murale numérique, mise à jour chaque seconde.
export default function LiveClock({ className, style }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const label = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <span className={className} style={style}>
      🕐 {label}
    </span>
  );
}
