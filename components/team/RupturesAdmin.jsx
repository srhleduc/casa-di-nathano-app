"use client";

import { useState } from "react";
import { useRuptures, addRupture, removeRupture, useMenu } from "@/lib/data";
import { CATEGORIES } from "@/lib/menu";

export default function RupturesAdmin() {
  const { ruptures } = useRuptures();
  const { menuItems } = useMenu();
  const [cat, setCat] = useState("pizza");
  const items = menuItems.filter((m) => m.cat === cat);

  function toggle(id) {
    if (ruptures.includes(id)) removeRupture(id).catch((err) => console.error(err));
    else addRupture(id).catch((err) => console.error(err));
  }

  const rupturedItems = menuItems.filter((m) => ruptures.includes(m.id));

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {rupturedItems.length > 0 && (
        <div className="rounded-xl mb-6 px-5 py-4" style={{ background: "#2c1c14", border: "1px solid #C0392B" }}>
          <div className="font-bold mb-2">🚫 En rupture actuellement ({rupturedItems.length})</div>
          <div className="flex flex-wrap gap-2">
            {rupturedItems.map((it) => (
              <button
                key={it.id}
                onClick={() => toggle(it.id)}
                className="chip tap-scale text-sm"
                style={{ background: "#C0392B", borderColor: "#C0392B", color: "#fff5ea", borderRadius: 999, padding: "6px 14px", fontWeight: 700 }}
              >
                ✕ {it.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 mb-5 overflow-x-auto">
        {CATEGORIES.map((c) => (
          <button key={c.key} onClick={() => setCat(c.key)} className={`tap-scale shrink-0 rounded-full px-5 py-2 font-bold border-2 text-sm ${cat === c.key ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {items.map((it) => {
          const isOut = ruptures.includes(it.id);
          return (
            <button
              key={it.id}
              onClick={() => toggle(it.id)}
              className="tap-scale rounded-full px-4 py-2 font-bold border-2 text-sm"
              style={isOut ? { background: "#C0392B", borderColor: "#C0392B", color: "#fff5ea" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
            >
              {isOut ? "🚫 " : ""}
              {it.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
