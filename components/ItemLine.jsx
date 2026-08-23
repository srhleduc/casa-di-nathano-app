"use client";

import { noteIcon } from "@/lib/menu";

export default function ItemLine({ it }) {
  return (
    <li className="mb-1.5">
      <div>
        {it.qty}× {it.name}
      </div>
      {it.note && (
        <div className="text-xs text-[#E8B23D] pl-4">
          ↳ {noteIcon(it.name, it.note)} {it.note}
        </div>
      )}
      {(it.modifiers || []).map((m, mi) => {
        const isRemoved = m.name.startsWith("Sans ");
        const label = isRemoved ? m.name.slice(5) : m.name.replace(/^Supplément /, "");
        return (
          <div key={mi} className="text-xs pl-4 flex items-center gap-1.5">
            <span className="font-bold" style={{ color: isRemoved ? "#e88a8a" : "#a8e8c8" }}>
              {isRemoved ? "−" : "+"}
            </span>
            <span className="text-[#a88f78]">{label}</span>
          </div>
        );
      })}
    </li>
  );
}
