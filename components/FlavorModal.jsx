"use client";

import { useState } from "react";
import { flavorConfigFor } from "@/lib/menu";

export default function FlavorModal({ item, onClose, onConfirm }) {
  const { flavors, need } = flavorConfigFor(item.name);
  const [picked, setPicked] = useState([]);

  // Chaque tap ajoute une boule (plusieurs boules du même parfum sont
  // possibles) ; une fois le quota atteint, le choix le plus ancien est
  // remplacé. Pour corriger un choix précis, on le retire de "Ta sélection".
  function add(f) {
    setPicked((prev) => (prev.length >= need ? [...prev.slice(1), f] : [...prev, f]));
  }
  function removeAt(idx) {
    setPicked((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70">
      <div className="pizza-modal w-full md:max-w-2xl md:rounded-3xl overflow-hidden flex flex-col" style={{ background: "#1a120b", color: "#f5ebdd", height: "min(80vh, 640px)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a2b1f]">
          <span className="display-font text-2xl font-bold">{item.name}</span>
          <button onClick={onClose} className="tap-scale w-9 h-9 rounded-full bg-[#241811] text-[#c9b8a4] font-bold">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="text-[#a88f78] mb-4">
            Choisis {need} parfum{need > 1 ? "s" : ""} ({picked.length}/{need}) — plusieurs boules du même parfum possibles
          </p>

          {picked.length > 0 && (
            <div className="mb-5 pb-5 border-b border-[#3a2b1f]">
              <div className="text-xs text-[#a88f78] uppercase font-bold mb-2">Ta sélection (touche pour retirer)</div>
              <div className="flex flex-wrap gap-2">
                {picked.map((f, idx) => (
                  <button key={idx} onClick={() => removeAt(idx)} className="chip tap-scale" style={{ background: "#C0392B", borderColor: "#C0392B", color: "#fff5ea" }}>
                    {f} ✕
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {flavors.map((f) => (
              <button key={f} onClick={() => add(f)} className="chip tap-scale" style={{ color: "#c9b8a4" }}>
                + {f}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-5 border-t border-[#3a2b1f]">
          <button
            onClick={() => onConfirm(picked.join(", "))}
            disabled={picked.length !== need}
            className="tap-scale w-full rounded-full py-5 text-xl font-bold disabled:opacity-40"
            style={{ background: "#C0392B", color: "#fff5ea" }}
          >
            Ajouter au panier
          </button>
        </div>
      </div>
    </div>
  );
}
