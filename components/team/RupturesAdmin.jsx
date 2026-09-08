"use client";

import { useState } from "react";
import { useRuptures, addRupture, removeRupture, useMenu, useFlavors } from "@/lib/data";
import { CATEGORIES, FLAVOR_GROUPS, flavorGroupFor, flavorRuptureKey, parseFlavorRuptureKey, flavorsForGroup } from "@/lib/menu";

const CHIP_OUT = {
  background: "#C0392B",
  borderColor: "#C0392B",
  color: "#fff5ea",
  borderRadius: 999,
  padding: "6px 14px",
  fontWeight: 700,
};

export default function RupturesAdmin() {
  const { ruptures } = useRuptures();
  const { menuItems } = useMenu();
  const { flavors: liveByGroup } = useFlavors();
  const [cat, setCat] = useState("pizza");
  const [openFlavorItem, setOpenFlavorItem] = useState(null); // id du produit à parfums déplié
  const items = menuItems.filter((m) => m.cat === cat);

  function toggle(key) {
    if (ruptures.includes(key)) removeRupture(key).catch((err) => console.error(err));
    else addRupture(key).catch((err) => console.error(err));
  }

  const rupturedItems = menuItems.filter((m) => ruptures.includes(m.id));
  const rupturedFlavors = ruptures.map(parseFlavorRuptureKey).filter(Boolean);

  const openItem = openFlavorItem ? menuItems.find((m) => m.id === openFlavorItem) : null;
  const openGroupKey = openItem ? flavorGroupFor(openItem.name) : null;
  const outFlavorCount = (it) => {
    const g = flavorGroupFor(it.name);
    if (!g) return 0;
    return flavorsForGroup(liveByGroup, g).filter((f) => ruptures.includes(flavorRuptureKey(g, f))).length;
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="text-xs text-[#8a7561] mb-4 max-w-2xl">
        Un produit noté en rupture le reste jusqu'à sa réactivation ici — plus de remise à zéro automatique la nuit.
        Aucune limite de nombre. Pour les glaces et sirops, clique le produit pour choisir les parfums indisponibles un
        par un.
      </div>

      {(rupturedItems.length > 0 || rupturedFlavors.length > 0) && (
        <div className="rounded-xl mb-6 px-5 py-4" style={{ background: "#2c1c14", border: "1px solid #C0392B" }}>
          <div className="font-bold mb-2">
            🚫 En rupture actuellement ({rupturedItems.length + rupturedFlavors.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {rupturedItems.map((it) => (
              <button key={it.id} onClick={() => toggle(it.id)} className="chip tap-scale text-sm" style={CHIP_OUT}>
                ✕ {it.name}
              </button>
            ))}
            {rupturedFlavors.map(({ group, flavor }) => (
              <button
                key={`${group}:${flavor}`}
                onClick={() => toggle(flavorRuptureKey(group, flavor))}
                className="chip tap-scale text-sm"
                style={CHIP_OUT}
              >
                ✕ {flavor} · {(FLAVOR_GROUPS[group]?.label || group).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 mb-5 overflow-x-auto">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => {
              setCat(c.key);
              setOpenFlavorItem(null);
            }}
            className={`tap-scale shrink-0 rounded-full px-5 py-2 font-bold border-2 text-sm ${cat === c.key ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {items.map((it) => {
          const flavorGroup = flavorGroupFor(it.name);
          if (flavorGroup) {
            const outN = outFlavorCount(it);
            const isOpen = openFlavorItem === it.id;
            const wholeOut = ruptures.includes(it.id);
            return (
              <button
                key={it.id}
                onClick={() => setOpenFlavorItem(isOpen ? null : it.id)}
                className="tap-scale rounded-full px-4 py-2 font-bold border-2 text-sm"
                style={
                  isOpen
                    ? { borderColor: "#e8622c", background: "#2c1c14", color: "#fff5ea" }
                    : wholeOut || outN > 0
                    ? { borderColor: "#C0392B", color: "#e8a8a8" }
                    : { borderColor: "#3a2b1f", color: "#c9b8a4" }
                }
              >
                {it.name}
                {wholeOut ? " · 🚫 tout" : outN > 0 ? ` · 🚫 ${outN} parfum${outN > 1 ? "s" : ""}` : ""} ▾
              </button>
            );
          }
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
        {items.length === 0 && <p className="text-[#8a7561]">Aucun produit dans cette catégorie.</p>}
      </div>

      {openItem && openGroupKey && (
        <div className="mt-5 rounded-xl border border-[#3a2b1f] bg-[#211712] p-4 max-w-2xl">
          <div className="flex items-center justify-between mb-2">
            <div className="font-bold">Parfums indisponibles — {openItem.name}</div>
            <button onClick={() => setOpenFlavorItem(null)} className="text-xs text-[#8a7561] tap-scale">
              Fermer
            </button>
          </div>
          <div className="text-xs text-[#8a7561] mb-3">
            Un parfum coché est retiré pour toutes les tailles de {(FLAVOR_GROUPS[openGroupKey].label || "").toLowerCase()} — côté
            client comme en prise de commande.
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {flavorsForGroup(liveByGroup, openGroupKey).map((f) => {
              const key = flavorRuptureKey(openGroupKey, f);
              const out = ruptures.includes(key);
              return (
                <button
                  key={f}
                  onClick={() => toggle(key)}
                  className="tap-scale rounded-full px-3 py-1.5 text-xs font-bold border-2"
                  style={out ? { background: "#C0392B", borderColor: "#C0392B", color: "#fff5ea" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
                >
                  {out ? "🚫 " : ""}
                  {f}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => toggle(openItem.id)}
            className="tap-scale rounded-full px-4 py-2 text-xs font-bold border-2"
            style={ruptures.includes(openItem.id) ? { background: "#C0392B", borderColor: "#C0392B", color: "#fff5ea" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
          >
            {ruptures.includes(openItem.id) ? "🚫 Tout le produit indisponible" : "Marquer tout le produit indisponible"}
          </button>
        </div>
      )}
    </div>
  );
}
