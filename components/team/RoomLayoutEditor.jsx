"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useRoomLayouts,
  createRoomLayout,
  saveRoomLayout,
  renameRoomLayout,
  deleteRoomLayout,
  setRoomLayoutActive,
  useTables,
  useTableCombinations,
  useCirculationConstraints,
  createCirculationConstraint,
  updateCirculationConstraint,
  deleteCirculationConstraint,
  updateTable,
  setTableActive,
} from "@/lib/data";
import { evaluateConstraints } from "@/lib/reservation/constraints";
import { cellCode, isSplit, normalizeGrid } from "@/lib/reservation/grid";
import { tableDisplayName } from "@/lib/business";
import TableConfigFields from "./TableConfigFields";
import TablePriorityList from "./TablePriorityList";

const PRIORITIES = [
  { value: "obligatoire", label: "Obligatoire" },
  { value: "fortement_recommande", label: "Fortement recommandé" },
  { value: "preferable", label: "Préférable" },
];

// Éditeur de plan de salle quadrillé (module Réservation). Unité de base : une
// case = une table (70 cm). Une case peut être coupée en 2 demi-cases (35 cm)
// via le mode « Demi-cases », pour les ajustements de largeur de passage.
// Stockage → table room_layouts (Supabase).

const TOOLS = [
  { code: "empty", label: "Vide", color: "#3a2b1f", bg: "#1a120b" },
  { code: "S", label: "Siège", color: "#8A85D9", bg: "#241f3a" },
  { code: "P", label: "Passage", color: "#6FB583", bg: "#16281c" },
  { code: "T", label: "Table (70 cm)", color: "#D9689F", bg: "#331526" },
  { code: "D", label: "Porte", color: "#D9A72B", bg: "#332a12" },
  { code: "W", label: "Travail / attente", color: "#D9704F", bg: "#331d16" },
];
const TOOL_BY_CODE = Object.fromEntries(TOOLS.map((t) => [t.code, t]));
const CELL_PX = 34;

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

export default function RoomLayoutEditor({ readOnly = false }) {
  const { layouts, loading } = useRoomLayouts();
  const { tables } = useTables();
  const { combinations } = useTableCombinations();
  const { constraints } = useCirculationConstraints();
  const [activeId, setActiveId] = useState(null);
  const [rows, setRows] = useState(12);
  const [cols, setCols] = useState(12);
  const [cells, setCells] = useState([]);
  const [tool, setTool] = useState("T");
  const [status, setStatus] = useState("");
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Demi-cases : coupe une case (une table, 70 cm) en 2 moitiés de 35 cm pour
  // les ajustements de largeur de passage. Exception, pas la norme. Le moteur
  // de contraintes raisonne toujours en 35 cm (grid.js expandTo35).
  const [halfMode, setHalfMode] = useState(false);
  const [halfAxis, setHalfAxis] = useState("v"); // "v" = gauche/droite, "h" = haut/bas
  // Mode « Configurer les tables » : un clic sur la grille sélectionne la table
  // posée sur cette case (panneau de config façon TheFork) au lieu de peindre ;
  // un clic sur une case vide propose d'y poser une table non placée.
  const [mode, setMode] = useState("paint"); // "paint" | "config"
  const [selTableId, setSelTableId] = useState(null);
  const [pendingCell, setPendingCell] = useState(null); // { r, c } | null
  // Ajout d'une contrainte de circulation : capture des extrémités sur la grille.
  const [ccDraft, setCcDraft] = useState(null); // { name, a, b, width, priority } | null
  const [pickMode, setPickMode] = useState(null); // "A" | "B" | null

  const painting = useRef(false);
  const downInfo = useRef(null); // { x, y, type } du pointerdown en cours
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
    setCells(normalizeGrid(active.cells, gr, gc));
    hydratedFor.current = active.id;
  }, [active]);

  // Change de plan → on oublie la sélection de config en cours.
  useEffect(() => {
    setSelTableId(null);
    setPendingCell(null);
  }, [activeId]);

  const selTable = useMemo(() => tables.find((t) => t.id === selTableId) || null, [tables, selTableId]);

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

  // Peint une case entière (recolle une éventuelle demi-case).
  function paintCell(r, c) {
    setCells((prev) => {
      if (prev[r]?.[c] === tool) return prev;
      const next = prev.map((row) => row.slice());
      next[r][c] = tool;
      queueSave(rows, cols, next);
      return next;
    });
  }

  // Peint une moitié d'une case (mode demi-cases). half = "a" | "b".
  function paintHalf(r, c, half) {
    setCells((prev) => {
      const cur = prev[r]?.[c];
      let a, b, s;
      if (isSplit(cur)) {
        a = cur.a;
        b = cur.b;
        s = cur.s;
      } else {
        a = cellCode(cur);
        b = cellCode(cur);
        s = halfAxis;
      }
      if (half === "a") a = tool;
      else b = tool;
      const nextCell = a === b ? a : { s, a, b };
      if (JSON.stringify(nextCell) === JSON.stringify(cur)) return prev;
      const next = prev.map((row) => row.slice());
      next[r][c] = nextCell;
      queueSave(rows, cols, next);
      return next;
    });
  }

  function paintAt(r, c, half) {
    if (readOnly || r < 0 || r >= rows || c < 0 || c >= cols) return;
    if (halfMode && half) paintHalf(r, c, half);
    else paintCell(r, c);
  }

  function cellFromPoint(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || !el.dataset || el.dataset.r === undefined) return null;
    return { r: Number(el.dataset.r), c: Number(el.dataset.c), half: el.dataset.h || null };
  }
  function onGridPointerDown(e) {
    if (readOnly) return;
    const cell = cellFromPoint(e);
    if (pickMode && cell) {
      setCcDraft((d) => ({ ...(d || {}), [pickMode === "A" ? "a" : "b"]: { row: cell.r, col: cell.c } }));
      setPickMode(null);
      return;
    }
    // Mode config : sélectionner la table posée sur la case, ou préparer un
    // placement sur une case vide. Jamais de peinture.
    if (mode === "config") {
      if (!cell) return;
      const hit = placedTables.find((pt) => pt.gridRow === cell.r && pt.gridCol === cell.c);
      if (hit) {
        setSelTableId(hit.id);
        setPendingCell(null);
      } else {
        setSelTableId(null);
        setPendingCell({ r: cell.r, c: cell.c });
      }
      return;
    }
    downInfo.current = { x: e.clientX, y: e.clientY, type: e.pointerType };
    // Souris / stylet : peinture au clic + au glissé. Tactile : on ne peint
    // qu'au relâchement si c'était un tap (sinon le glissé fait défiler la grille).
    if (e.pointerType !== "touch") {
      painting.current = true;
      if (cell) paintAt(cell.r, cell.c, cell.half);
    }
  }
  function onGridPointerMove(e) {
    if (!painting.current) return;
    const cell = cellFromPoint(e);
    if (cell) paintAt(cell.r, cell.c, cell.half);
  }
  function onGridPointerUp(e) {
    const d = downInfo.current;
    downInfo.current = null;
    if (d && d.type === "touch") {
      const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12;
      if (!moved) {
        const cell = cellFromPoint(e);
        if (cell) paintAt(cell.r, cell.c, cell.half);
      }
    }
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

  // --- contraintes de circulation + diagnostic (moteur de contraintes) ---
  const layoutConstraints = useMemo(() => constraints.filter((c) => c.layoutId === activeId), [constraints, activeId]);
  const placedTables = useMemo(
    () => tables.filter((t) => t.layoutId === activeId && t.gridRow != null && t.gridCol != null),
    [tables, activeId]
  );
  // Tables non posées sur CE plan (actives) — candidates au placement.
  const unplacedTables = useMemo(
    () => tables.filter((t) => t.active && !(t.layoutId === activeId && t.gridRow != null && t.gridCol != null)),
    [tables, activeId]
  );

  function placeTableAt(tableId, r, c) {
    updateTable(tableId, { layoutId: activeId, gridRow: r, gridCol: c })
      .then(() => {
        setSelTableId(tableId);
        setPendingCell(null);
      })
      .catch((e) => console.error(e));
  }
  function unplaceTable(tableId) {
    updateTable(tableId, { gridRow: null, gridCol: null })
      .then(() => setSelTableId(null))
      .catch((e) => console.error(e));
  }
  // L'éditeur travaille toujours en « 1 case = 1 table » (70 cm), quel que
  // soit le cell_size_cm stocké — le moteur détaille en 35 cm.
  const layoutForEngine = { gridRows: rows, gridCols: cols, cellSizeCm: 70, cells };
  const diagnostic = useMemo(
    () => evaluateConstraints(layoutForEngine, placedTables, layoutConstraints, { combinations }),
    [rows, cols, cells, placedTables, layoutConstraints, combinations]
  );

  // marqueurs A/B à afficher sur la grille
  const endpointMarks = useMemo(() => {
    const m = new Map();
    layoutConstraints.forEach((c, i) => {
      m.set(`${c.endpointA.row},${c.endpointA.col}`, `A${i + 1}`);
      m.set(`${c.endpointB.row},${c.endpointB.col}`, `B${i + 1}`);
    });
    if (ccDraft?.a) m.set(`${ccDraft.a.row},${ccDraft.a.col}`, "A");
    if (ccDraft?.b) m.set(`${ccDraft.b.row},${ccDraft.b.col}`, "B");
    return m;
  }, [layoutConstraints, ccDraft]);

  function startCcDraft() {
    setCcDraft({ name: "", a: null, b: null, width: 2, priority: "obligatoire" });
    setPickMode("A");
  }
  function saveCcDraft() {
    if (!ccDraft?.name?.trim() || !ccDraft.a || !ccDraft.b || !activeId) return;
    createCirculationConstraint({
      layoutId: activeId,
      name: ccDraft.name,
      endpointA: ccDraft.a,
      endpointB: ccDraft.b,
      minWidthCells: Math.max(1, ccDraft.width || 1),
      priority: ccDraft.priority,
    })
      .then(() => {
        setCcDraft(null);
        setPickMode(null);
      })
      .catch((err) => console.error(err));
  }

  const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };

  if (loading) {
    return <div className="flex-1 px-6 py-10 text-[#8a7561]">Chargement du plan…</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <p className="text-xs text-[#8a7561] mb-4 max-w-2xl">
        Grille de la salle : <b>une case = une table (70 cm)</b>. Un clic pose ou retire une table entière. Les{" "}
        <b>passages</b> indiquent une obligation de circulation dont le tracé exact pourra bouger ; les <b>portes</b> et{" "}
        <b>zones travail/attente</b> servent de repères au moteur. Pour les ajustements fins de largeur de passage,
        active <b>« Demi-cases (35 cm) »</b>. Passe en <b>« Configurer les tables »</b> pour cliquer une table et régler
        ses places, sa disponibilité en ligne et ses combinaisons. Sauvegarde automatique.
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
              {layouts.length > 1 && active && (
                <button
                  onClick={() => setRoomLayoutActive(active.id, active.active === false).catch((err) => console.error(err))}
                  className="tap-scale text-xs font-bold rounded-full px-3 py-2 border-2"
                  style={
                    active.active === false
                      ? { borderColor: "#204a3a", color: "#a8e8c8" }
                      : { borderColor: "#4a2020", color: "#e8a8a8" }
                  }
                >
                  {active.active === false ? "☀️ Zone fermée — rouvrir" : "🌧️ Fermer cette zone"}
                </button>
              )}
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
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => { setMode("paint"); setSelTableId(null); setPendingCell(null); }}
            className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2"
            style={mode === "paint" ? { borderColor: "#C0392B", background: "#2c1c14", color: "#fff5ea" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
          >
            ✏️ Dessiner la salle
          </button>
          <button
            onClick={() => { setMode("config"); }}
            className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2"
            style={mode === "config" ? { borderColor: "#C0392B", background: "#2c1c14", color: "#fff5ea" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
          >
            🪑 Configurer les tables
          </button>
        </div>
      )}

      {!readOnly && mode === "paint" && (
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
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button
                onClick={() => setHalfMode((v) => !v)}
                className="tap-scale rounded-full px-3 py-1.5 text-xs font-bold border-2"
                style={halfMode ? { borderColor: "#e8622c", background: "#2c1c14", color: "#fff5ea" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
              >
                {halfMode ? "✓ Demi-cases (35 cm)" : "Demi-cases (35 cm)"}
              </button>
              {halfMode && (
                <>
                  <button
                    onClick={() => setHalfAxis("v")}
                    className="tap-scale rounded-full px-3 py-1.5 text-xs font-bold border-2"
                    style={halfAxis === "v" ? { borderColor: "#e8622c", color: "#fff5ea" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
                  >
                    ◧ gauche / droite
                  </button>
                  <button
                    onClick={() => setHalfAxis("h")}
                    className="tap-scale rounded-full px-3 py-1.5 text-xs font-bold border-2"
                    style={halfAxis === "h" ? { borderColor: "#e8622c", color: "#fff5ea" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
                  >
                    ⬒ haut / bas
                  </button>
                </>
              )}
              <span className="text-xs text-[#5a4a3a]">
                {halfMode
                  ? "Clique une moitié de case pour la peindre à 35 cm. Deux moitiés identiques recollent la case."
                  : "Une case = une table (70 cm). Un clic = une table entière."}
              </span>
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

      {pickMode && (
        <div className="rounded-lg px-3 py-2 mb-2 text-sm font-bold" style={{ background: "#1f5aa8", color: "#fff5ea" }}>
          Clique la case du <b>point {pickMode}</b> du passage sur la grille.
        </div>
      )}

      {!readOnly && mode === "config" && !selTable && !pendingCell && (
        <div className="rounded-lg px-3 py-2 mb-2 text-sm" style={{ background: "#2c1c14", border: "1px solid #C0392B", color: "#fff5ea" }}>
          Clique une <b>table posée</b> sur la grille pour la configurer, ou une <b>case vide</b> pour y placer une table.
        </div>
      )}

      {/* Grille — zone de défilement bornée (les deux axes, tactile compris) */}
      <div
        className="rounded-xl border border-[#3a2b1f] bg-[#1a120b] p-3"
        style={{ overflow: "auto", maxHeight: "min(62vh, 560px)", WebkitOverflowScrolling: "touch" }}
      >
        <div
          onPointerDown={onGridPointerDown}
          onPointerMove={onGridPointerMove}
          onPointerUp={onGridPointerUp}
          className="grid"
          style={{ gridTemplateColumns: `repeat(${cols}, ${CELL_PX}px)`, gap: 2, width: "max-content", touchAction: "pan-x pan-y", userSelect: "none" }}
        >
          {cells.map((row, r) =>
            row.map((cell, c) => {
              const mark = endpointMarks.get(`${r},${c}`);
              const placed = placedTables.some((pt) => r === pt.gridRow && c === pt.gridCol);
              const isSel = selTable && r === selTable.gridRow && c === selTable.gridCol;
              const isPending = pendingCell && r === pendingCell.r && c === pendingCell.c;
              const split = isSplit(cell);
              const showHalves = split || halfMode;
              const axis = split ? cell.s : halfAxis;
              const border = isSel
                ? "3px solid #fff5ea"
                : isPending
                ? "3px solid #e8622c"
                : placed
                ? "2px solid #D9689F"
                : `1px solid ${mark ? "#7fb0ff" : (TOOL_BY_CODE[cellCode(cell)] || TOOL_BY_CODE.empty).color}`;
              const common = {
                width: CELL_PX,
                height: CELL_PX,
                borderRadius: 4,
                border,
                overflow: "hidden",
                cursor: readOnly ? "default" : "pointer",
              };
              if (!showHalves) {
                const tc = TOOL_BY_CODE[cellCode(cell)] || TOOL_BY_CODE.empty;
                return (
                  <div
                    key={`${r}-${c}`}
                    data-r={r}
                    data-c={c}
                    title={`L${r + 1} · C${c + 1}`}
                    className="flex items-center justify-center"
                    style={{ ...common, background: mark ? "#1f5aa8" : tc.bg, color: "#fff5ea", fontSize: 11, fontWeight: 700 }}
                  >
                    {mark || (placed ? "▦" : "")}
                  </div>
                );
              }
              const codeA = split ? cell.a : cellCode(cell);
              const codeB = split ? cell.b : cellCode(cell);
              const tA = TOOL_BY_CODE[codeA] || TOOL_BY_CODE.empty;
              const tB = TOOL_BY_CODE[codeB] || TOOL_BY_CODE.empty;
              return (
                <div key={`${r}-${c}`} title={`L${r + 1} · C${c + 1}`} className="relative flex" style={{ ...common, flexDirection: axis === "h" ? "column" : "row" }}>
                  <div data-r={r} data-c={c} data-h="a" style={{ flex: 1, background: tA.bg }} />
                  <div data-r={r} data-c={c} data-h="b" style={{ flex: 1, background: tB.bg }} />
                  {(mark || placed) && (
                    <span className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ color: "#fff5ea", fontSize: 10, fontWeight: 700 }}>
                      {mark || "▦"}
                    </span>
                  )}
                </div>
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
        <span className="flex items-center gap-1.5 text-xs text-[#a88f78]">
          <span className="inline-block w-3 h-3 rounded" style={{ background: "#1f5aa8" }} />
          Extrémité de passage (A/B)
        </span>
        <span className="flex items-center gap-1.5 text-xs text-[#a88f78]">
          <span className="inline-block w-3 h-3 rounded" style={{ border: "2px solid #D9689F" }} />
          Table placée (config)
        </span>
      </div>

      {/* Panneau de configuration des tables (mode « Configurer les tables ») */}
      {!readOnly && mode === "config" && (
        <div className="rounded-xl border-2 p-4 mt-4" style={{ borderColor: "#C0392B", background: "#211712" }}>
          {selTable ? (
            <>
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div className="text-sm font-bold">
                  Table sélectionnée · <span className="text-xs font-normal text-[#8a7561]">L{selTable.gridRow + 1} · C{selTable.gridCol + 1}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => unplaceTable(selTable.id)}
                    className="tap-scale rounded-full px-3 py-1.5 text-xs font-bold border-2 border-[#3a2b1f] text-[#a88f78]"
                  >
                    Retirer du plan
                  </button>
                  <button
                    onClick={() => setTableActive(selTable.id, !selTable.active).catch((e) => console.error(e))}
                    className="tap-scale rounded-full px-3 py-1.5 text-xs font-bold border-2"
                    style={selTable.active ? { borderColor: "#4a2020", color: "#e8a8a8" } : { borderColor: "#204a3a", color: "#a8e8c8" }}
                  >
                    {selTable.active ? "Désactiver" : "Réactiver"}
                  </button>
                  <button onClick={() => setSelTableId(null)} className="tap-scale text-xs text-[#8a7561] font-bold">
                    Fermer
                  </button>
                </div>
              </div>
              <TableConfigFields t={selTable} others={tables.filter((x) => x.active && x.id !== selTable.id)} showName />
            </>
          ) : pendingCell ? (
            <>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="text-sm font-bold">
                  Placer une table en <span className="text-xs font-normal text-[#8a7561]">L{pendingCell.r + 1} · C{pendingCell.c + 1}</span>
                </div>
                <button onClick={() => setPendingCell(null)} className="tap-scale text-xs text-[#8a7561] font-bold">
                  Annuler
                </button>
              </div>
              {unplacedTables.length === 0 ? (
                <p className="text-xs text-[#8a7561]">
                  Toutes les tables actives sont déjà placées sur ce plan. Crée-en une dans l'onglet « Tables ».
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {unplacedTables.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => placeTableAt(t.id, pendingCell.r, pendingCell.c)}
                      className="tap-scale rounded-full px-3 py-1.5 text-xs font-bold border-2 border-[#3a2b1f]"
                    >
                      {tableDisplayName(t)}
                      {t.layoutId && t.layoutId !== activeId ? " (autre plan)" : ""}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-[#8a7561]">
              Clique une table posée sur la grille pour la configurer, ou une case vide pour y placer une table.
            </p>
          )}

          <div className="mt-4 pt-4 border-t border-[#3a2b1f]">
            <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Ordre de priorité de remplissage</div>
            <div className="text-xs text-[#5a4a3a] mb-3">
              Global à l'établissement. À choix équivalent, le moteur remplit d'abord les tables du haut.
            </div>
            <TablePriorityList tables={tables} />
          </div>
        </div>
      )}

      {/* Contraintes de circulation */}
      <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4 mt-4">
        <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Contraintes de circulation de ce plan</div>
        <div className="text-xs text-[#5a4a3a] mb-3">
          Un chemin de la largeur mini doit toujours relier les 2 points, quelles que soient les tables placées. Le
          moteur déplace le tracé du passage autour des tables — il vérifie l'existence d'un chemin, pas un tracé figé.
        </div>

        <div className="flex flex-col gap-2 mb-3">
          {layoutConstraints.map((c, i) => (
            <div key={c.id} className="flex items-center justify-between gap-3 flex-wrap text-sm">
              <span>
                <b>{c.name}</b> <span className="text-xs text-[#8a7561]">A{i + 1}(L{c.endpointA.row + 1}·C{c.endpointA.col + 1}) → B{i + 1}(L{c.endpointB.row + 1}·C{c.endpointB.col + 1})</span>
              </span>
              <div className="flex items-center gap-2 text-xs">
                <label className="flex items-center gap-1">
                  larg.
                  <input
                    type="number"
                    min={1}
                    value={c.minWidthCells}
                    onChange={(e) => updateCirculationConstraint(c.id, { minWidthCells: Math.max(1, parseInt(e.target.value, 10) || 1) }).catch((err) => console.error(err))}
                    className="w-12 rounded px-1.5 py-0.5"
                    style={inputStyle}
                  />
                  <span className="text-[#5a4a3a]">≈ {c.minWidthCells * 35} cm</span>
                </label>
                <select
                  value={c.priority}
                  onChange={(e) => updateCirculationConstraint(c.id, { priority: e.target.value }).catch((err) => console.error(err))}
                  className="rounded px-1.5 py-0.5"
                  style={inputStyle}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <button onClick={() => deleteCirculationConstraint(c.id).catch((err) => console.error(err))} className="tap-scale text-red-400 font-bold">
                  ✕
                </button>
              </div>
            </div>
          ))}
          {layoutConstraints.length === 0 && <span className="text-xs text-[#5a4a3a]">Aucune contrainte définie.</span>}
        </div>

        {!readOnly &&
          (ccDraft ? (
            <div className="rounded-lg border border-[#3a2b1f] p-3 flex flex-wrap items-center gap-2">
              <input
                value={ccDraft.name}
                onChange={(e) => setCcDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Nom (ex. Accès WC)"
                className="rounded-lg px-2 py-1 text-sm"
                style={inputStyle}
              />
              <button
                onClick={() => setPickMode("A")}
                className="tap-scale rounded-full px-3 py-1.5 text-xs font-bold border-2"
                style={ccDraft.a ? { borderColor: "#1f5aa8", color: "#7fb0ff" } : { borderColor: "#3a2b1f" }}
              >
                📍 Point A {ccDraft.a ? `(L${ccDraft.a.row + 1}·C${ccDraft.a.col + 1})` : ""}
              </button>
              <button
                onClick={() => setPickMode("B")}
                className="tap-scale rounded-full px-3 py-1.5 text-xs font-bold border-2"
                style={ccDraft.b ? { borderColor: "#1f5aa8", color: "#7fb0ff" } : { borderColor: "#3a2b1f" }}
              >
                📍 Point B {ccDraft.b ? `(L${ccDraft.b.row + 1}·C${ccDraft.b.col + 1})` : ""}
              </button>
              <label className="flex items-center gap-1 text-xs">
                larg.
                <input
                  type="number"
                  min={1}
                  value={ccDraft.width}
                  onChange={(e) => setCcDraft((d) => ({ ...d, width: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                  className="w-12 rounded px-1.5 py-0.5"
                  style={inputStyle}
                />
                <span className="text-[#5a4a3a]">≈ {ccDraft.width * 35} cm</span>
              </label>
              <select value={ccDraft.priority} onChange={(e) => setCcDraft((d) => ({ ...d, priority: e.target.value }))} className="rounded px-1.5 py-0.5 text-xs" style={inputStyle}>
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button
                onClick={saveCcDraft}
                disabled={!ccDraft.name.trim() || !ccDraft.a || !ccDraft.b}
                className="tap-scale rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                style={{ background: "#C0392B", color: "#fff5ea" }}
              >
                Créer
              </button>
              <button onClick={() => { setCcDraft(null); setPickMode(null); }} className="tap-scale text-xs text-[#8a7561] font-bold">
                Annuler
              </button>
            </div>
          ) : (
            <button onClick={startCcDraft} className="tap-scale rounded-full px-3 py-1.5 text-xs font-bold border-2 border-[#3a2b1f]">
              + Ajouter une contrainte
            </button>
          ))}
      </div>

      {/* Diagnostic */}
      <div
        className="rounded-xl border p-4 mt-4"
        style={diagnostic.valid ? { borderColor: "#204a3a", background: "#16281c" } : { borderColor: "#C0392B", background: "#2c1c14" }}
      >
        <div className="font-bold text-sm mb-1">
          {diagnostic.valid ? "✓ Disposition valide" : `✗ ${diagnostic.violations.length} contrainte(s) violée(s)`}
          {diagnostic.penalty > 0 && <span className="text-xs font-normal text-[#e8b23d]"> · pénalité {diagnostic.penalty}</span>}
        </div>
        <div className="text-xs text-[#8a7561] mb-2">
          {placedTables.length} table(s) placée(s) sur ce plan · {layoutConstraints.length} contrainte(s) de circulation
        </div>
        {diagnostic.violations.map((v, i) => (
          <div key={i} className="text-xs" style={{ color: "#e88a8a" }}>
            • {v.message}
          </div>
        ))}
        {diagnostic.notes.map((n, i) => (
          <div key={i} className="text-xs" style={{ color: "#e8b23d" }}>
            • {n}
          </div>
        ))}
      </div>
    </div>
  );
}
