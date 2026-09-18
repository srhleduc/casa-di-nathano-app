"use client";

import { useState } from "react";
import { optionRuptureKey } from "@/lib/menu";
import { useOptionGroups } from "@/lib/data";

// Choix des options (parfums, cuisson…) pour un produit qui porte une ou
// plusieurs sous-catégories. Le résultat est renvoyé sous forme d'une note
// texte via onConfirm — « Vanille, Chocolat » pour une seule sous-catégorie,
// « Parfum : Vanille · Cuisson : Bien cuite » quand il y en a plusieurs.
export default function FlavorModal({ item, ruptures, onClose, onConfirm }) {
  const { forItem } = useOptionGroups();
  const groups = forItem(item);
  const [picks, setPicks] = useState({}); // { [groupId]: [optionName, ...] }

  const availableOptions = (g) =>
    g.options.filter((o) => !(ruptures || []).includes(optionRuptureKey(g.id, o.name)));

  // Chaque tap ajoute un choix ; une fois le quota du groupe atteint, le plus
  // ancien est remplacé (plusieurs boules d'un même parfum restent possibles).
  function add(g, name) {
    setPicks((prev) => {
      const cur = prev[g.id] || [];
      const next = cur.length >= g.choices ? [...cur.slice(1), name] : [...cur, name];
      return { ...prev, [g.id]: next };
    });
  }
  function removeAt(g, idx) {
    setPicks((prev) => ({ ...prev, [g.id]: (prev[g.id] || []).filter((_, i) => i !== idx) }));
  }

  const groupOk = (g) => {
    const n = (picks[g.id] || []).length;
    return g.required ? n === g.choices : n === 0 || n === g.choices;
  };
  const canConfirm = groups.every(groupOk);

  function confirm() {
    const multi = groups.length > 1;
    const note = groups
      .map((g) => ({ g, sel: picks[g.id] || [] }))
      .filter((x) => x.sel.length > 0)
      .map((x) => (multi ? `${x.g.name} : ${x.sel.join(", ")}` : x.sel.join(", ")))
      .join(" · ");
    onConfirm(note);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70">
      <div className="pizza-modal w-full md:max-w-2xl md:rounded-3xl overflow-hidden flex flex-col" style={{ background: "var(--color-bg)", color: "var(--color-text)", height: "min(80vh, 640px)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
          <span className="display-font text-2xl font-bold">{item.name}</span>
          <button onClick={onClose} className="tap-scale w-9 h-9 rounded-full font-bold" style={{ background: "var(--color-surface)", color: "var(--color-text-subtle)" }}>
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {groups.map((g) => {
            const picked = picks[g.id] || [];
            const options = availableOptions(g);
            return (
              <div key={g.id}>
                <p className="mb-3" style={{ color: "var(--color-text-muted)" }}>
                  <span className="font-bold" style={{ color: "var(--color-text)" }}>{g.name}</span> — choisis {g.choices}
                  {g.choices > 1 ? " options" : " option"} ({picked.length}/{g.choices})
                  {!g.required && <span style={{ color: "var(--color-text-dim)" }}> · facultatif</span>}
                </p>

                {picked.length > 0 && (
                  <div className="mb-4 pb-4 border-b" style={{ borderColor: "var(--color-border)" }}>
                    <div className="text-xs uppercase font-bold mb-2" style={{ color: "var(--color-text-muted)" }}>Ta sélection (touche pour retirer)</div>
                    <div className="flex flex-wrap gap-2">
                      {picked.map((f, idx) => (
                        <button key={idx} onClick={() => removeAt(g, idx)} className="chip tap-scale" style={{ background: "var(--color-accent)", borderColor: "var(--color-accent)", color: "var(--color-text-alt)" }}>
                          {f} ✕
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {options.map((o) => (
                    <button key={o.id} onClick={() => add(g, o.name)} className="chip tap-scale" style={{ color: "var(--color-text-subtle)" }}>
                      + {o.name}
                    </button>
                  ))}
                  {options.length === 0 && (
                    <p className="text-sm" style={{ color: "var(--color-danger)" }}>Toutes les options sont indisponibles pour l'instant.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-5 border-t" style={{ borderColor: "var(--color-border)" }}>
          <button
            onClick={confirm}
            disabled={!canConfirm}
            className="tap-scale w-full rounded-full py-5 text-xl font-bold disabled:opacity-40"
            style={{ background: "var(--color-accent)", color: "var(--color-text-alt)" }}
          >
            Ajouter au panier
          </button>
        </div>
      </div>
    </div>
  );
}
