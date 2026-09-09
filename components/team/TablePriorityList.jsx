"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { reorderTablePriority } from "@/lib/data";
import { tableDisplayName, sortByFillPriority } from "@/lib/business";

// Ordre de priorité de remplissage — global à l'établissement. Le moteur, à
// choix équivalent, remplit d'abord les tables du haut de la liste. Glisser-
// déposer (souris/stylet) + flèches ▲▼ (fiable au tactile).

export default function TablePriorityList({ tables }) {
  const [dragId, setDragId] = useState(null);
  const [localOrder, setLocalOrder] = useState(null); // ids en cours de réarrangement
  const commitTimer = useRef(null);
  const seededRef = useRef(false);

  const activeTables = useMemo(() => (tables || []).filter((t) => t.active), [tables]);
  const baseOrder = useMemo(() => sortByFillPriority(activeTables).map((t) => t.id), [activeTables]);

  // Si aucune table n'a encore de priority_order, on enregistre une bonne fois
  // l'ordre affiché (tri naturel) : sinon l'écran « semble » configuré alors
  // que la base est vide et le moteur n'a rien à suivre.
  useEffect(() => {
    if (seededRef.current) return;
    if (activeTables.length > 0 && activeTables.every((t) => t.priorityOrder == null)) {
      seededRef.current = true;
      reorderTablePriority(baseOrder).catch((e) => console.error(e));
    }
  }, [activeTables, baseOrder]);

  const order = localOrder || baseOrder;
  const byId = useMemo(() => Object.fromEntries((tables || []).map((t) => [t.id, t])), [tables]);

  function commit(nextOrder) {
    setLocalOrder(nextOrder);
    clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      reorderTablePriority(nextOrder)
        .then(() => setLocalOrder(null))
        .catch((e) => console.error(e));
    }, 400);
  }

  function move(id, dir) {
    const i = order.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  }

  function onDrop(targetId) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const next = order.filter((x) => x !== dragId);
    const at = next.indexOf(targetId);
    next.splice(at, 0, dragId);
    setDragId(null);
    commit(next);
  }

  if (order.length === 0) return <p className="text-xs text-[#5a4a3a]">Aucune table active.</p>;

  return (
    <ol className="flex flex-col gap-1.5">
      {order.map((id, idx) => {
        const t = byId[id];
        if (!t) return null;
        return (
          <li
            key={id}
            draggable
            onDragStart={() => setDragId(id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(id)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 border-2"
            style={{ borderColor: dragId === id ? "#C0392B" : "#3a2b1f", background: "#211712", cursor: "grab" }}
          >
            <span className="text-xs font-mono text-[#8a7561] w-6 shrink-0">{idx + 1}.</span>
            <span className="text-sm font-bold flex-1 truncate">{tableDisplayName(t)}</span>
            {t.blocked && <span className="text-xs text-[#e8a8a8]">bloquée</span>}
            <span className="text-[#5a4a3a] text-xs">⠿</span>
            <button onClick={() => move(id, -1)} disabled={idx === 0} className="tap-scale text-xs px-2 py-1 rounded border-2 border-[#3a2b1f] disabled:opacity-30">
              ▲
            </button>
            <button onClick={() => move(id, 1)} disabled={idx === order.length - 1} className="tap-scale text-xs px-2 py-1 rounded border-2 border-[#3a2b1f] disabled:opacity-30">
              ▼
            </button>
          </li>
        );
      })}
    </ol>
  );
}
