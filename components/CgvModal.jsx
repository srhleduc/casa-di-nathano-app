"use client";

// Conditions générales de vente — affichées en modale depuis le checkout du
// click & collect (garde le panier intact, pas de navigation). Le texte vient
// de lib/cgv.js et c'est ce même texte qui est snapshoté à l'acceptation.

import { CGV_TEXT, CGV_NO_SHOW_CLAUSE } from "@/lib/cgv";

export default function CgvModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70">
      <div
        className="w-full md:max-w-2xl md:rounded-3xl overflow-hidden flex flex-col"
        style={{ background: "#1a120b", color: "#f5ebdd", height: "min(85vh, 720px)" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a2b1f]">
          <span className="display-font text-2xl font-bold">Conditions générales de vente</span>
          <button onClick={onClose} className="tap-scale w-9 h-9 rounded-full bg-[#241811] text-[#c9b8a4] font-bold">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div
            className="rounded-xl px-4 py-3 mb-5 text-sm font-bold"
            style={{ background: "#2c1c14", border: "1px solid #C0392B", color: "#f5ebdd" }}
          >
            ⚠️ {CGV_NO_SHOW_CLAUSE}
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#c9b8a4]">{CGV_TEXT}</pre>
        </div>

        <div className="px-6 py-4 border-t border-[#3a2b1f]">
          <button
            onClick={onClose}
            className="tap-scale w-full rounded-full py-4 text-lg font-bold"
            style={{ background: "#C0392B", color: "#fff5ea" }}
          >
            J'ai compris
          </button>
        </div>
      </div>
    </div>
  );
}
