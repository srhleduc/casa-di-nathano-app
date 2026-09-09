"use client";

import { useState } from "react";
import { updateTable, setTableLabel } from "@/lib/data";
import { tableDisplayName } from "@/lib/business";

// Panneau de configuration d'une table (façon TheFork), partagé entre l'onglet
// « Tables » et l'éditeur de plan de salle (clic sur une table du plan).
//   - Nom (renommable à tout moment, le code QR ne bouge pas)
//   - Disponible pour les réservations en ligne
//   - Bloquer la table (non réservable sauf ajout manuel par l'équipe)
//   - Nombre de places min / préféré / max
//   - Tables habituellement collées / rapprochables / jamais combinées
// L'ordre de priorité de remplissage est global à l'établissement → composant
// séparé (TablePriorityList).

const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };

function ToggleRow({ label, hint, on, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="tap-scale w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 border-2 text-left"
      style={on ? { borderColor: "#C0392B", background: "#2c1c14" } : { borderColor: "#3a2b1f" }}
    >
      <span>
        <span className="text-sm font-bold" style={{ color: on ? "#fff5ea" : "#c9b8a4" }}>
          {label}
        </span>
        {hint && <span className="block text-xs text-[#8a7561]">{hint}</span>}
      </span>
      <span
        className="shrink-0 rounded-full text-xs font-bold px-3 py-1"
        style={on ? { background: "#C0392B", color: "#fff5ea" } : { background: "#3a2b1f", color: "#a88f78" }}
      >
        {on ? "Oui" : "Non"}
      </span>
    </button>
  );
}

function RelationRow({ label, others, selected, onToggle }) {
  return (
    <div className="mb-2">
      <div className="text-xs text-[#a88f78] mb-1">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {others.map((o) => {
          const on = selected.includes(o.id);
          return (
            <button
              key={o.id}
              onClick={() => onToggle(o.id)}
              className="tap-scale rounded-full px-2.5 py-1 text-xs font-bold border-2"
              style={on ? { borderColor: "#C0392B", background: "#2c1c14", color: "#fff5ea" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
            >
              {on ? "✓ " : ""}
              {tableDisplayName(o)}
            </button>
          );
        })}
        {others.length === 0 && <span className="text-xs text-[#5a4a3a]">Aucune autre table.</span>}
      </div>
    </div>
  );
}

function NameEditor({ t }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tableDisplayName(t));
  function commit() {
    const v = value.trim();
    setEditing(false);
    if (!v || v === tableDisplayName(t)) {
      setValue(tableDisplayName(t));
      return;
    }
    setTableLabel(t.id, v).catch((e) => console.error(e));
  }
  return (
    <div className="mb-3">
      <div className="text-xs text-[#a88f78] mb-1">Nom de la table</div>
      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setValue(tableDisplayName(t));
              setEditing(false);
            }
          }}
          className="display-font text-lg font-bold rounded-lg px-2 py-1 outline-none w-44"
          style={{ background: "#140d08", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
        />
      ) : (
        <button
          onClick={() => {
            setValue(tableDisplayName(t));
            setEditing(true);
          }}
          className="display-font text-lg font-bold tap-scale text-left"
        >
          {tableDisplayName(t)} <span className="text-sm text-[#8a7561]">✏️</span>
        </button>
      )}
    </div>
  );
}

export default function TableConfigFields({ t, others = [], showName = false }) {
  // Capacités : garde min ≤ préféré ≤ max à chaque écriture.
  function setCapacity(field, raw) {
    const n = Math.max(1, parseInt(raw, 10) || 1);
    const cur = {
      capacityMin: t.capacityMin ?? 1,
      capacityPreferred: t.capacityPreferred ?? 2,
      capacityMax: t.capacityMax ?? 2,
    };
    cur[field] = n;
    if (cur.capacityMin > cur.capacityMax) {
      if (field === "capacityMin") cur.capacityMax = cur.capacityMin;
      else cur.capacityMin = cur.capacityMax;
    }
    cur.capacityPreferred = Math.min(cur.capacityMax, Math.max(cur.capacityMin, cur.capacityPreferred));
    updateTable(t.id, cur).catch((e) => console.error(e));
  }

  function toggleRelation(field, id) {
    const arr = t[field] || [];
    const next = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
    const patch = { [field]: next };
    // « Jamais combinée » est exclusif des deux autres relations.
    if (field === "nonCombinableWith" && !arr.includes(id)) {
      patch.usuallyCombinedWith = (t.usuallyCombinedWith || []).filter((x) => x !== id);
      patch.combinableWith = (t.combinableWith || []).filter((x) => x !== id);
    }
    if ((field === "usuallyCombinedWith" || field === "combinableWith") && !arr.includes(id)) {
      patch.nonCombinableWith = (t.nonCombinableWith || []).filter((x) => x !== id);
    }
    updateTable(t.id, patch).catch((e) => console.error(e));
  }

  const capMin = t.capacityMin ?? 1;
  const capPref = t.capacityPreferred ?? t.capacityBase ?? 2;
  const capMax = t.capacityMax ?? t.capacityBase ?? 2;
  const bookable = t.bookableOnline ?? true;
  const blocked = t.blocked ?? false;

  return (
    <div>
      {showName && <NameEditor t={t} />}

      <div className="flex flex-col gap-2 mb-4">
        <ToggleRow
          label="Disponible pour les réservations en ligne"
          hint="Décoché : la table n'est jamais proposée sur la page /reserver."
          on={bookable}
          onToggle={() => updateTable(t.id, { bookableOnline: !bookable }).catch((e) => console.error(e))}
        />
        <ToggleRow
          label="Bloquer la table"
          hint="Non réservable par le moteur — sauf ajout manuel par l'équipe."
          on={blocked}
          onToggle={() => updateTable(t.id, { blocked: !blocked }).catch((e) => console.error(e))}
        />
      </div>

      <div className="mb-4">
        <div className="text-xs text-[#a88f78] mb-1">Nombre de places</div>
        <div className="flex flex-wrap gap-3">
          {[
            ["Min", "capacityMin", capMin],
            ["Préféré", "capacityPreferred", capPref],
            ["Max", "capacityMax", capMax],
          ].map(([lbl, field, val]) => (
            <label key={field} className="flex items-center gap-1.5 text-xs text-[#a88f78]">
              {lbl}
              <input
                type="number"
                min={1}
                value={val}
                onChange={(e) => setCapacity(field, e.target.value)}
                className="w-16 rounded-lg px-2 py-1 text-sm"
                style={inputStyle}
              />
            </label>
          ))}
        </div>
        <div className="text-xs text-[#5a4a3a] mt-1">
          Le moteur remplit vers la capacité <b>préférée</b> et n'utilise le <b>max</b> qu'en cas de besoin.
        </div>
      </div>

      <RelationRow label="Habituellement collée à" others={others} selected={t.usuallyCombinedWith || []} onToggle={(id) => toggleRelation("usuallyCombinedWith", id)} />
      <RelationRow label="Peut être rapprochée de" others={others} selected={t.combinableWith || []} onToggle={(id) => toggleRelation("combinableWith", id)} />
      <RelationRow label="Jamais combinée avec" others={others} selected={t.nonCombinableWith || []} onToggle={(id) => toggleRelation("nonCombinableWith", id)} />
    </div>
  );
}
