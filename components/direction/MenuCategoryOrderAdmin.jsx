"use client";

import { useEffect, useState } from "react";
import { CATEGORIES, orderedCategories } from "@/lib/menu";
import { useCategoryOrder, setCategoryOrder } from "@/lib/data";

const LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, `${c.emoji} ${c.label}`]));

function Column({ title, hint, keys, onMove }) {
  return (
    <div className="rounded-2xl border border-[#3a2b1f] bg-[#211712] p-5 flex-1 min-w-[260px]">
      <div className="display-font text-lg font-bold mb-1">{title}</div>
      <div className="text-xs text-[#8a7561] mb-4">{hint}</div>
      <div className="flex flex-col gap-2">
        {keys.map((k, i) => (
          <div key={k} className="flex items-center justify-between rounded-xl border border-[#3a2b1f] bg-[#1a120b] px-4 py-3">
            <span className="font-bold">
              <span className="text-[#8a7561] mr-2">{i + 1}.</span>
              {LABEL[k] || k}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onMove(i, -1)}
                disabled={i === 0}
                className="tap-scale w-9 h-9 rounded-full bg-[#3a2b1f] text-lg font-bold disabled:opacity-30"
                aria-label="Monter"
              >
                ↑
              </button>
              <button
                onClick={() => onMove(i, 1)}
                disabled={i === keys.length - 1}
                className="tap-scale w-9 h-9 rounded-full bg-[#3a2b1f] text-lg font-bold disabled:opacity-30"
                aria-label="Descendre"
              >
                ↓
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MenuCategoryOrderAdmin() {
  const { categoryOrder } = useCategoryOrder();
  const [local, setLocal] = useState(null); // { client:[keys], staff:[keys] } pendant l'aller-retour serveur

  // Toujours la liste complète des catégories, dans l'ordre enregistré (les
  // catégories jamais rangées apparaissent à la fin, ordre naturel).
  const order = local || {
    client: orderedCategories(categoryOrder.client).map((c) => c.key),
    staff: orderedCategories(categoryOrder.staff).map((c) => c.key),
  };

  // Dès que le serveur confirme notre écriture (realtime), on repart de la
  // source de vérité.
  const sig = `${categoryOrder.client.join(",")}|${categoryOrder.staff.join(",")}`;
  useEffect(() => {
    setLocal(null);
  }, [sig]);

  function move(scope, idx, dir) {
    const arr = [...order[scope]];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    setLocal({ ...order, [scope]: arr });
    setCategoryOrder(scope, arr).catch((e) => console.error(e));
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <p className="text-[#a88f78] text-sm mb-6 max-w-3xl">
        Ordre des onglets de catégories sur l'écran de commande. Réglage <b>commun aux deux restaurants</b>, appliqué
        aussitôt (borne, <span className="font-mono">/commande</span>, <span className="font-mono">/sat</span> pour la vue
        client ; prise de commande, édition et commande programmée pour la vue équipe).
      </p>
      <div className="flex flex-wrap gap-5">
        <Column
          title="👤 Vue client"
          hint="Borne · lien /commande · lien /sat"
          keys={order.client}
          onMove={(i, d) => move("client", i, d)}
        />
        <Column
          title="🧑‍🍳 Vue équipe"
          hint="Prise de commande · édition · commande programmée"
          keys={order.staff}
          onMove={(i, d) => move("staff", i, d)}
        />
      </div>
    </div>
  );
}
