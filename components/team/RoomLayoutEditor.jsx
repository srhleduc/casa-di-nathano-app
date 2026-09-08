"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRoomLayouts, createRoomLayout, saveRoomLayout, renameRoomLayout, deleteRoomLayout } from "@/lib/data";

// Éditeur de plan de salle quadrillé (module Réservation). Porté du prototype
// floorplan-editor.html : grille peignable, +/− lignes & colonnes sur chaque
// bord, plans nommés multiples. Stockage → table room_layouts (Supabase).
// Une table 70×70 = 2×2 cases à cell_size_cm = 35.

const TOOLS = [
  { code: "empty", label: "Vide", color: "#3a2b1f", bg: "#1a120b" },
  { code: "S", label: "Siège", color: "#8A85D9", bg: "#241f3a" },
  { code: "P", label: "Passage", color: "#6FB583", bg: "#16281c" },
  { code: "T", label: "Table 70×70", color: "#D9689F", bg: "#331526" },
  { code: "D", label: "Porte", color: "#D9A72B", bg: "#332a12" },
  { code: "W", label: "Travail / attente", color: "#D9704F", bg: "#331d16" },
];
const TOOL_BY_CODE = Object.fromEntries(TOOLS.map((t) => [t.code, t]));
const CELL_PX = 28;

// Modèle repris du prototype (photo de la salle Casa discutée en amont) — sert
// de point de départ, à ajuster ensuite dans l'éditeur.
const CASA_SEED = [
  ["empty", "S", "P", "S", "P", "S", "P", "P", "S", "empty"],
  ["S", "T", "P", "T", "P", "T", "P", "P", "T", "S"],
  ["P", "P", "P", "S", "P", "S", "P", "P", "P", "P"],
  ["D", "P", "P", "P", "P", "P", "P", "P", "P", "P"],
  ["D", "P", "P", "S", "T", "S", "P", "S", "T", "S"],
  ["D", "P", "P", "P", "P", "P", "P", "P", "P", "P"],
  ["D", "P", "P", "S", "T", "S", "P", "S", "T", "S"],
  ["D", "P", "P", "S", "T", "S", "P", "W", "W", "W"],
  ["W", "W", "W", "W", "W", "W", "W", "W", "W", "W"],
  ["W", "W", "W", "W", "W", "W", "W", "W", "W", "W"],
];

const VALID = new Set(TOOLS.map((t) => t.code));

// Force `cells` en matrice rows×cols de codes valides (le seed SQL arrive vide).
function normalizeCells(cells, rows, cols) {
  const out = [];
  for (let r = 0; r < rows; r++) {
    const src = Array.isArray(cells) && Array.isArray(cells[r]) ? cells[r] : [];
    const row = [];
    for (let c = 0; c < cols; c++) row.push(VALID.has(src[c]) ? src[c] : "empty");
    out.push(row);
  }
  return out;
}

export default function RoomLayoutEditor({ readOnly = false }) {
  const { layouts, loading } = useRoomLayouts();
  const [activeId, setActiveId] = useState(null);
  const [rows, setRows] = useState(12);
  const [cols, setCols] = useState(12);
  const [cells, setCells] = useState([]);
  const [tool, setTool] = useState("T");
  const [status, setStatus] = useState("");
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const painting = useRef(false);
  const saveTimer = useRef(null);
  const hydratedFor = useRef(null);

  const active = useMemo(() => layouts.find((l) => l.id === activeId) || null, [layouts, activeId]);

  // Sélection par défaut : premier plan de la liste.
  useEffect(() => {
    if (!activeId && layouts.length > 0) setActiveId(layouts[0].id);
    if (activeId && layouts.length > 0 && !layouts.some((l) => l.id === activeId)) setActiveId(layouts[0].id);
  }, [layouts, activeId]);

  // Hydrate l'état local depuis le plan sélectionné (une fois par plan).
  useEffect(() => {
    if (!active || hydratedFor.current === active.id) return;
    const gr = active.gridRows || 12;
    const gc = active.gridCols || 12;
    setRows(gr);
    setCols(gc);
    setCells(normalizeCells(active.cells, gr, gc));
    hydratedFor.current = active.id;
  }, [active]);

  function queueSave(nextRows, nextCols, nextCells) {
    if (readOnly || !activeId) return;
    setStatus("Enregistrement…");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveRoomLayout(activeId, { gridRows: nextRows, gridCols: nextCols, cells: nextCells })
        .then(() => {
          setStatus("Enregistré ✓");
          setTimeout(() => setStatus(""), 1200);
        })
        .catch((err) => {
          console.error(err);
          setStatus("Échec de l'enregistrement");
        });
    }, 500);
  }

  function paint(r, c) {
    if (readOnly || r < 0 || r >= rows || c < 0 || c >= cols) return;
    setCells((prev) => {
      if (prev[r]?.[c] === tool) return prev;
      const next = prev.map((row) => row.slice());
      next[r][c] = tool;
      queueSave(rows, cols, next);
      return next;
    });
  }

  function onGridPointerDown(e) {
    if (readOnly) return;
    painting.current = true;
    paintFromPoint(e);
  }
  function onGridPointerMove(e) {
    if (!painting.current) return;
    paintFromPoint(e);
  }
  function paintFromPoint(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || !el.dataset || el.dataset.r === undefined) return;
    paint(Number(el.dataset.r), Number(el.dataset.c));
  }
  useEffect(() => {
    const stop = () => {
      painting.current = false;
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  // --- dimensions ---
  function resize(nextRows, nextCols, nextCells) {
    setRows(nextRows);
    setCols(nextCols);
    setCells(nextCells);
    queueSave(nextRows, nextCols, nextCells);
  }
  function addRow(pos) {
    const newRow = Array.from({ length: cols }, () => "empty");
    resize(rows + 1, cols, pos === "top" ? [newRow, ...cells] : [...cells, newRow]);
  }
  function removeRow(pos) {
    if (rows <= 1) return;
    resize(rows - 1, cols, pos === "top" ? cells.slice(1) : cells.slice(0, -1));
  }
  function addCol(pos) {
    resize(rows, cols + 1, cells.map((row) => (pos === "left" ? ["empty", ...row] : [...row, "empty"])));
  }
  function removeCol(pos) {
    if (cols <= 1) return;
    resize(rows, cols - 1, cells.map((row) => (pos === "left" ? row.slice(1) : row.slice(0, -1))));
  }
  function loadCasaModel() {
    if (readOnly) return;
    resize(10, 10, CASA_SEED.map((row) => row.slice()));
  }

  // --- plans ---
  async function doCreate() {
    const name = newName.trim();
    if (!name) return;
    try {
      const id = await createRoomLayout(name, { gridRows: 12, gridCols: 12 });
      setNewName("");
      hydratedFor.current = null;
      setActiveId(id);
    } catch (err) {
      console.error(err);
      alert("Échec de la création du plan.");
    }
  }
  async function doDuplicate() {
    if (!active) return;
    const base = active.name;
    const names = new Set(layouts.map((l) => l.name));
    let name = `${base} (copie)`;
    let i = 2;
    while (names.has(name)) name = `${base} (copie ${i++})`;
    try {
      const id = await createRoomLayout(name, { gridRows: rows, gridCols: cols, cells });
      hydratedFor.current = null;
      setActiveId(id);
    } catch (err) {
      console.error(err);
    }
  }
  async function doRename() {
    if (!active) return;
    const name = window.prompt("Nouveau nom du plan", active.name);
    if (!name || !name.trim() || name.trim() === active.name) return;
    renameRoomLayout(active.id, name).catch((err) => console.error(err));
  }
  async function doDelete() {
    if (!active || layouts.length <= 1) return;
    try {
      await deleteRoomLayout(active.id);
      setConfirmDelete(false);
      hydratedFor.current = null;
      setActiveId(null);
    } catch (err) {
      console.error(err);
    }
  }

  const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };

  if (loading) {
    return <div className="flex-1 px-6 py-10 text-[#8a7561]">Chargement du plan…</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <p className="text-xs text-[#8a7561] mb-4 max-w-2xl">
        Grille de la salle. Peins les cases avec l'outil choisi : une <b>table</b> de 70×70 cm occupe 2×2 cases (case = 35 cm).
        Les <b>passages</b> indiquent une obligation de circulation dont le tracé exact pourra bouger ; les <b>portes</b> et{" "}
        <b>zones travail/attente</b> servent de repères au moteur. Sauvegarde automatique.
      </p>

      {/* Sélecteur de plan */}
      <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={activeId || ""}
            onChange={(e) => {
              hydratedFor.current = null;
              setActiveId(e.target.value);
              setConfirmDelete(false);
            }}
            className="rounded-lg px-3 py-2 text-sm font-bold"
            style={inputStyle}
          >
            {layouts.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          {!readOnly && (
            <>
              <button onClick={doDuplicate} className="tap-scale text-xs font-bold rounded-full px-3 py-2 border-2 border-[#3a2b1f]">
                Dupliquer
              </button>
              <button onClick={doRename} className="tap-scale text-xs font-bold rounded-full px-3 py-2 border-2 border-[#3a2b1f]">
                Renommer
              </button>
              {layouts.length > 1 &&
                (confirmDelete ? (
                  <button onClick={doDelete} className="tap-scale text-xs font-bold rounded-full px-3 py-2" style={{ background: "#C0392B", color: "#fff5ea" }}>
                    Confirmer la suppression ?
                  </button>
                ) : (
                  <button onClick={() => setConfirmDelete(true)} className="tap-scale text-xs text-red-400 font-bold">
                    Supprimer
                  </button>
                ))}
              <span className="text-xs text-[#8a7561] ml-auto">{status}</span>
            </>
          )}
        </div>
        {!readOnly && (
          <div className="flex gap-2 mt-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doCreate()}
              placeholder="Nom d'un nouveau plan (ex. Terrasse)"
              className="flex-1 rounded-lg px-3 py-2 text-sm"
              style={inputStyle}
            />
            <button onClick={doCreate} disabled={!newName.trim()} className="tap-scale rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-40" style={{ background: "#C0392B", color: "#fff5ea" }}>
              + Créer
            </button>
          </div>
        )}
      </div>

      {!readOnly && (
        <>
          {/* Palette */}
          <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4 mb-4">
            <div className="text-xs text-[#a88f78] uppercase font-bold mb-2">Outil de peinture</div>
            <div className="flex flex-wrap gap-2">
              {TOOLS.map((t) => (
                <button
                  key={t.code}
                  onClick={() => setTool(t.code)}
                  className="tap-scale flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold border-2"
                  style={tool === t.code ? { borderColor: t.color, background: t.bg, color: "#f5ebdd" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
                >
                  <span className="inline-block w-3.5 h-3.5 rounded" style={{ background: t.color }} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dimensions */}
          <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-[#a88f78] mb-1">Lignes ({rows})</div>
                <div className="flex gap-2">
                  <button onClick={() => addRow("top")} className="tap-scale flex-1 rounded-lg py-2 text-xs font-bold border-2 border-[#3a2b1f]">+ haut</button>
                  <button onClick={() => addRow("bottom")} className="tap-scale flex-1 rounded-lg py-2 text-xs font-bold border-2 border-[#3a2b1f]">+ bas</button>
                  <button onClick={() => removeRow("top")} className="tap-scale flex-1 rounded-lg py-2 text-xs font-bold border-2 border-[#3a2b1f] text-[#a88f78]">− haut</button>
                  <button onClick={() => removeRow("bottom")} className="tap-scale flex-1 rounded-lg py-2 text-xs font-bold border-2 border-[#3a2b1f] text-[#a88f78]">− bas</button>
                </div>
              </div>
              <div>
                <div className="text-xs text-[#a88f78] mb-1">Colonnes ({cols})</div>
                <div className="flex gap-2">
                  <button onClick={() => addCol("left")} className="tap-scale flex-1 rounded-lg py-2 text-xs font-bold border-2 border-[#3a2b1f]">+ gauche</button>
                  <button onClick={() => addCol("right")} className="tap-scale flex-1 rounded-lg py-2 text-xs font-bold border-2 border-[#3a2b1f]">+ droite</button>
                  <button onClick={() => removeCol("left")} className="tap-scale flex-1 rounded-lg py-2 text-xs font-bold border-2 border-[#3a2b1f] text-[#a88f78]">− gauche</button>
                  <button onClick={() => removeCol("right")} className="tap-scale flex-1 rounded-lg py-2 text-xs font-bold border-2 border-[#3a2b1f] text-[#a88f78]">− droite</button>
                </div>
              </div>
            </div>
            <button onClick={loadCasaModel} className="tap-scale mt-3 rounded-full px-3 py-1.5 text-xs font-bold border-2 border-[#3a2b1f] text-[#a88f78]">
              Charger le modèle Casa (10×10)
            </button>
          </div>
        </>
      )}

      {/* Grille */}
      <div className="rounded-xl border border-[#3a2b1f] bg-[#1a120b] p-3 overflow-auto">
        <div
          onPointerDown={onGridPointerDown}
          onPointerMove={onGridPointerMove}
          className="grid mx-auto"
          style={{ gridTemplateColumns: `repeat(${cols}, ${CELL_PX}px)`, gap: 2, width: "max-content", touchAction: "none", userSelect: "none" }}
        >
          {cells.map((row, r) =>
            row.map((code, c) => {
              const t = TOOL_BY_CODE[code] || TOOL_BY_CODE.empty;
              return (
                <div
                  key={`${r}-${c}`}
                  data-r={r}
                  data-c={c}
                  title={`L${r + 1} · C${c + 1}`}
                  style={{
                    width: CELL_PX,
                    height: CELL_PX,
                    borderRadius: 4,
                    background: t.bg,
                    border: `1px solid ${t.color}`,
                    cursor: readOnly ? "default" : "pointer",
                  }}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-3 mt-3">
        {TOOLS.map((t) => (
          <span key={t.code} className="flex items-center gap-1.5 text-xs text-[#a88f78]">
            <span className="inline-block w-3 h-3 rounded" style={{ background: t.bg, border: `1px solid ${t.color}` }} />
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}
