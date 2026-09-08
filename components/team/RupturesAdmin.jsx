"use client";

import { useState } from "react";
import { useRuptures, addRupture, removeRupture, useMenu, useOptionGroups } from "@/lib/data";
import { CATEGORIES, optionRuptureKey, parseOptionRuptureKey } from "@/lib/menu";

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
  const { groups: optionGroups, forItem } = useOptionGroups();
  const [cat, setCat] = useState("pizza");
  const [openOptionItem, setOpenOptionItem] = useState(null); // id du produit à sous-catégories déplié
  const items = menuItems.filter((m) => m.cat === cat);

  function toggle(key) {
    if (ruptures.includes(key)) removeRupture(key).catch((err) => console.error(err));
    else addRupture(key).catch((err) => console.error(err));
  }

  // Sous-catégories réellement configurées en base pour ce produit (pas de repli
  // statique ici : l'onglet Ruptures ne pilote que des groupes existants).
  const groupsFor = (it) => forItem(it, false);
  const groupNameById = Object.fromEntries(optionGroups.map((g) => [g.id, g.name]));

  const rupturedItems = menuItems.filter((m) => ruptures.includes(m.id));
  const rupturedOptions = ruptures.map(parseOptionRuptureKey).filter(Boolean);

  const openItem = openOptionItem ? menuItems.find((m) => m.id === openOptionItem) : null;
  const openGroups = openItem ? groupsFor(openItem) : [];
  const outOptionCount = (it) =>
    groupsFor(it).reduce(
      (sum, g) => sum + g.options.filter((o) => ruptures.includes(optionRuptureKey(g.id, o.name))).length,
      0
    );

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="text-xs text-[#8a7561] mb-4 max-w-2xl">
        Un produit noté en rupture le reste jusqu'à sa réactivation ici — plus de remise à zéro automatique la nuit.
        Aucune limite de nombre. Pour un produit avec des sous-catégories (parfums, cuisson…), clique-le pour marquer
        des options indisponibles une par une.
      </div>

      {(rupturedItems.length > 0 || rupturedOptions.length > 0) && (
        <div className="rounded-xl mb-6 px-5 py-4" style={{ background: "#2c1c14", border: "1px solid #C0392B" }}>
          <div className="font-bold mb-2">
            🚫 En rupture actuellement ({rupturedItems.length + rupturedOptions.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {rupturedItems.map((it) => (
              <button key={it.id} onClick={() => toggle(it.id)} className="chip tap-scale text-sm" style={CHIP_OUT}>
                ✕ {it.name}
              </button>
            ))}
            {rupturedOptions.map(({ groupId, option }) => (
              <button
                key={`${groupId}:${option}`}
                onClick={() => toggle(optionRuptureKey(groupId, option))}
                className="chip tap-scale text-sm"
                style={CHIP_OUT}
              >
                ✕ {option}
                {groupNameById[groupId] ? ` · ${groupNameById[groupId].toLowerCase()}` : ""}
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
              setOpenOptionItem(null);
            }}
            className={`tap-scale shrink-0 rounded-full px-5 py-2 font-bold border-2 text-sm ${cat === c.key ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {items.map((it) => {
          const groups = groupsFor(it);
          if (groups.length > 0) {
            const outN = outOptionCount(it);
            const isOpen = openOptionItem === it.id;
            const wholeOut = ruptures.includes(it.id);
            return (
              <button
                key={it.id}
                onClick={() => setOpenOptionItem(isOpen ? null : it.id)}
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
                {wholeOut ? " · 🚫 tout" : outN > 0 ? ` · 🚫 ${outN} option${outN > 1 ? "s" : ""}` : ""} ▾
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

      {openItem && openGroups.length > 0 && (
        <div className="mt-5 rounded-xl border border-[#3a2b1f] bg-[#211712] p-4 max-w-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold">Options indisponibles — {openItem.name}</div>
            <button onClick={() => setOpenOptionItem(null)} className="text-xs text-[#8a7561] tap-scale">
              Fermer
            </button>
          </div>

          {openGroups.map((g) => (
            <div key={g.id} className="mb-4">
              <div className="text-xs text-[#a88f78] uppercase font-bold mb-2">{g.name}</div>
              <div className="flex flex-wrap gap-2">
                {g.options.map((o) => {
                  const key = optionRuptureKey(g.id, o.name);
                  const out = ruptures.includes(key);
                  return (
                    <button
                      key={o.id}
                      onClick={() => toggle(key)}
                      className="tap-scale rounded-full px-3 py-1.5 text-xs font-bold border-2"
                      style={out ? { background: "#C0392B", borderColor: "#C0392B", color: "#fff5ea" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
                    >
                      {out ? "🚫 " : ""}
                      {o.name}
                    </button>
                  );
                })}
                {g.options.length === 0 && (
                  <span className="text-xs text-[#5a4a3a]">Aucune option dans cette sous-catégorie.</span>
                )}
              </div>
            </div>
          ))}

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
