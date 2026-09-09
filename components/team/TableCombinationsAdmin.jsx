"use client";

import { useMemo, useState } from "react";
import {
  useTables,
  useTableCombinations,
  createTableCombination,
  updateTableCombination,
  deleteTableCombination,
} from "@/lib/data";
import { tableDisplayName } from "@/lib/business";
import { suggestCombinations, validateCombination } from "@/lib/reservation/combinations";

const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

export default function TableCombinationsAdmin() {
  const { tables } = useTables();
  const { combinations } = useTableCombinations();
  const [picked, setPicked] = useState([]); // table ids pour la création manuelle
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [err, setErr] = useState(null);

  const activeTables = useMemo(
    () => tables.filter((t) => t.active).sort((a, b) => collator.compare(tableDisplayName(a), tableDisplayName(b))),
    [tables]
  );
  const nameOf = (id) => {
    const t = tables.find((x) => x.id === id);
    return t ? tableDisplayName(t) : "?";
  };
  const labelFor = (ids) => [...ids].map(nameOf).sort((a, b) => collator.compare(a, b)).join(" + ");

  const suggestions = useMemo(() => suggestCombinations(tables, combinations), [tables, combinations]);
  const pickedCapacity = picked.reduce((s, id) => s + (tables.find((t) => t.id === id)?.capacityBase || 2), 0);

  function togglePick(id) {
    setErr(null);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }
  function createManual() {
    const v = validateCombination(picked, tables, nameOf);
    if (!v.ok) {
      setErr(v.reason);
      return;
    }
    setErr(null);
    createTableCombination({ tableIds: picked, capacity: pickedCapacity, isUsual: true, penaltyScore: 0 })
      .then(() => setPicked([]))
      .catch((e) => console.error(e));
  }

  const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };
  const sortedCombos = [...combinations].sort(
    (a, b) => Number(b.isUsual) - Number(a.isUsual) || a.tableIds.length - b.tableIds.length || labelFor(a.tableIds).localeCompare(labelFor(b.tableIds))
  );

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="text-xs text-[#8a7561] mb-5 max-w-2xl">
        Une combinaison = un groupe de tables rapprochées et sa capacité réelle (2 tables de 70×70 ≈ 4 couverts).
        Le moteur ne les additionne pas bêtement : seules les combinaisons listées ici sont utilisables. Une
        combinaison « exceptionnelle » (hors config habituelle) reçoit une pénalité et n'est choisie qu'en cas de besoin.
        Un groupe est valide s'il forme une <b>chaîne</b> dans « Peut être rapprochée de » (onglet Tables) : chaque table
        reliée à au moins une autre du groupe, de proche en proche — pas besoin de déclarer toutes les paires.
      </div>

      {/* Proposition automatique */}
      {suggestions.length > 0 && (
        <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4 mb-5">
          <div className="font-bold text-sm mb-2">Proposées d'après les relations saisies ({suggestions.length})</div>
          <div className="flex flex-col gap-2">
            {suggestions.map((s) => (
              <div key={s.tableIds.join("|")} className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-sm">
                  <b>{labelFor(s.tableIds)}</b> · {s.capacity} couv.
                  <span className="text-xs ml-2" style={{ color: s.isUsual ? "#a8e8c8" : "#e8b23d" }}>
                    {s.isUsual ? "habituelle" : "exceptionnelle"}
                  </span>
                </span>
                <button
                  onClick={() => createTableCombination(s).catch((e) => console.error(e))}
                  className="tap-scale rounded-full px-3 py-1.5 text-xs font-bold"
                  style={{ background: "#C0392B", color: "#fff5ea" }}
                >
                  + Ajouter
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Création manuelle */}
      <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4 mb-6">
        <div className="font-bold text-sm mb-2">Nouvelle combinaison</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {activeTables.map((t) => {
            const on = picked.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => togglePick(t.id)}
                className="tap-scale rounded-full px-2.5 py-1 text-xs font-bold border-2"
                style={on ? { borderColor: "#C0392B", background: "#2c1c14", color: "#fff5ea" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
              >
                {on ? "✓ " : ""}
                {tableDisplayName(t)}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#8a7561]">
            {picked.length} table{picked.length > 1 ? "s" : ""} · {pickedCapacity} couv.
          </span>
          <button
            onClick={createManual}
            disabled={picked.length < 2}
            className="tap-scale rounded-full px-4 py-2 text-sm font-bold disabled:opacity-40"
            style={{ background: "#C0392B", color: "#fff5ea" }}
          >
            Créer
          </button>
        </div>
        {err && (
          <div className="text-xs mt-2" style={{ color: "#e88a8a" }}>
            ✕ {err}
          </div>
        )}
      </div>

      {/* Liste enregistrée */}
      {sortedCombos.length === 0 ? (
        <p className="text-[#8a7561]">Aucune combinaison enregistrée.</p>
      ) : (
        <div className="flex flex-col gap-3 max-w-2xl">
          {sortedCombos.map((c) => (
            <div key={c.id} className="rounded-2xl border-2 border-[#3a2b1f] p-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="font-bold">{labelFor(c.tableIds)}</div>
                <div className="flex items-center gap-3 mt-1 text-xs text-[#a88f78]">
                  <label className="flex items-center gap-1">
                    couv.
                    <input
                      type="number"
                      min={1}
                      value={c.capacity}
                      onChange={(e) => updateTableCombination(c.id, { capacity: Math.max(1, parseInt(e.target.value, 10) || 1) }).catch((err) => console.error(err))}
                      className="w-14 rounded px-1.5 py-0.5"
                      style={inputStyle}
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    pénalité
                    <input
                      type="number"
                      min={0}
                      value={c.penaltyScore}
                      onChange={(e) => updateTableCombination(c.id, { penaltyScore: Math.max(0, parseInt(e.target.value, 10) || 0) }).catch((err) => console.error(err))}
                      className="w-14 rounded px-1.5 py-0.5"
                      style={inputStyle}
                    />
                  </label>
                  <button
                    onClick={() => updateTableCombination(c.id, { isUsual: !c.isUsual }).catch((err) => console.error(err))}
                    className="tap-scale rounded-full px-2.5 py-1 font-bold border-2"
                    style={c.isUsual ? { borderColor: "#204a3a", color: "#a8e8c8" } : { borderColor: "#4a3a10", color: "#e8b23d" }}
                  >
                    {c.isUsual ? "habituelle" : "exceptionnelle"}
                  </button>
                </div>
              </div>
              {confirmDelete === c.id ? (
                <button
                  onClick={() => {
                    deleteTableCombination(c.id).catch((e) => console.error(e));
                    setConfirmDelete(null);
                  }}
                  className="tap-scale rounded-full px-3 py-2 text-xs font-bold"
                  style={{ background: "#C0392B", color: "#fff5ea" }}
                >
                  Confirmer ?
                </button>
              ) : (
                <button onClick={() => setConfirmDelete(c.id)} className="tap-scale text-xs text-red-400 font-bold">
                  Supprimer
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
