"use client";

import { flavorConfigFor } from "@/lib/menu";

export default function ItemLine({ it }) {
  return (
    <li className="mb-1.5">
      <div>
        {it.qty}× {it.name}
      </div>
      {it.note && (
        <div className="text-xs text-[#E8B23D] pl-4">
          ↳ {flavorConfigFor(it.name)?.icon || "🍨"} {it.note}
        </div>
      )}
      {(it.modifiers || []).map((m, mi) => (
        <div key={mi} className="text-xs text-[#a88f78] pl-4">
          ↳ {m.name}
        </div>
      ))}
    </li>
  );
}
