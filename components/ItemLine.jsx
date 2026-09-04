"use client";

import { noteIcon } from "@/lib/menu";

// `showSource` : uniquement l'écran Caisse — badge par article de la source
// (borne à table / click & collect). Rien si l'article a été saisi par la
// serveuse (source absente), pour ne pas polluer la vue.
export default function ItemLine({ it, showSource }) {
  return (
    <li className="mb-1.5">
      <div>
        {it.qty}× {it.name}
        {showSource && it.source === "sat" && (
          <span
            className="ml-1.5 align-middle text-[10px] font-bold rounded px-1.5 py-0.5"
            style={{ background: "#2c1c14", color: "#E8B23D" }}
          >
            SAT
          </span>
        )}
        {showSource && it.source === "click_and_collect" && (
          <span className="ml-1.5 align-middle" title="Click &amp; collect">
            🛍️
          </span>
        )}
      </div>
      {it.note && (
        <div className="text-xs text-[#E8B23D] pl-4">
          ↳ {noteIcon(it.name, it.note)} {it.note}
        </div>
      )}
      {it.itemNote && (
        <div className="text-xs font-bold pl-4" style={{ color: "#ff5fa8" }}>
          ↳ 📝 {it.itemNote}
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
