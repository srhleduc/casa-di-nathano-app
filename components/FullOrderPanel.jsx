"use client";

import GroupedItemList from "./GroupedItemList";
import OrderNote from "./OrderNote";

const NEON = "#39ff14";

// Flèche fluo en haut à droite d'une carte de commande : déroule la commande
// COMPLÈTE (y compris ce qui concerne les autres postes), pour qu'un salarié
// seul n'ait pas à naviguer d'un écran à l'autre.
export function FullOrderToggleButton({ open, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? "Replier la commande complète" : "Voir la commande complète"}
      title={open ? "Replier" : "Voir la commande complète"}
      className="tap-scale w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
      style={{ background: NEON, color: "#0b1a05", boxShadow: `0 0 10px ${NEON}` }}
    >
      {open ? "▲" : "▼"}
    </button>
  );
}

// Contenu déroulé : tous les articles de la commande (les déjà servis sont
// marqués), puis la note de commande.
export function FullOrderPanel({ order }) {
  const items = (order.items || []).map((it) => (it.served ? { ...it, name: `${it.name} — servi ✓` } : it));
  return (
    <div className="mb-3 rounded-lg p-3" style={{ border: `2px solid ${NEON}`, background: "#141c0e" }}>
      <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: NEON }}>
        Commande complète
      </div>
      <GroupedItemList items={items} />
      <OrderNote note={order.note} />
    </div>
  );
}
