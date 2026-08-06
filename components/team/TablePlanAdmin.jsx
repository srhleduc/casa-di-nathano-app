"use client";

import { useEffect, useRef, useState } from "react";
import { useTablePlan, saveTablePlan } from "@/lib/data";
import { nextLocalId } from "@/lib/menu";

const EMPTY_PLAN = {
  defaultLayout: { interieur: [], exterieur: [], mangedebout: [] },
  currentLayout: { interieur: [], exterieur: [], mangedebout: [] },
};

export default function TablePlanAdmin() {
  const { tablePlan, loading } = useTablePlan();
  const [plan, setPlan] = useState(EMPTY_PLAN);
  const [initialized, setInitialized] = useState(false);

  // Le plan de table arrive de façon asynchrone : on ne l'utilise comme état
  // local éditable qu'une fois le premier chargement terminé.
  useEffect(() => {
    if (!loading && !initialized) {
      setPlan(tablePlan);
      setInitialized(true);
    }
  }, [loading, initialized, tablePlan]);

  function persist(nextPlan) {
    setPlan(nextPlan);
    saveTablePlan(nextPlan).catch((err) => console.error(err));
  }

  const [zone, setZone] = useState("interieur");
  const [newNumber, setNewNumber] = useState("");
  const [newSeats, setNewSeats] = useState("4");
  const [dragId, setDragId] = useState(null);
  const [dragPos, setDragPos] = useState(null); // position live pendant le déplacement
  const floorRef = useRef(null);

  const savedTables = plan.currentLayout[zone] || [];
  const tables = savedTables.map((t) => (dragId === t.id && dragPos ? { ...t, x: dragPos.x, y: dragPos.y } : t));
  const isModified = JSON.stringify(plan.currentLayout[zone]) !== JSON.stringify(plan.defaultLayout[zone]);

  function addTable() {
    if (!newNumber.trim()) return;
    const table = { id: nextLocalId("t"), number: newNumber.trim(), seats: parseInt(newSeats, 10) || 1, x: 45 + Math.random() * 10, y: 45 + Math.random() * 10 };
    persist({ ...plan, currentLayout: { ...plan.currentLayout, [zone]: [...savedTables, table] } });
    setNewNumber("");
  }

  function removeTable(id) {
    persist({ ...plan, currentLayout: { ...plan.currentLayout, [zone]: savedTables.filter((t) => t.id !== id) } });
  }

  function resetToDefault() {
    persist({ ...plan, currentLayout: { ...plan.currentLayout, [zone]: plan.defaultLayout[zone] } });
  }

  function saveAsDefault() {
    persist({ ...plan, defaultLayout: { ...plan.defaultLayout, [zone]: savedTables } });
  }

  function posFromEvent(e) {
    const rect = floorRef.current.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    const x = ((point.clientX - rect.left) / rect.width) * 100;
    const y = ((point.clientY - rect.top) / rect.height) * 100;
    return { x: Math.min(95, Math.max(5, x)), y: Math.min(92, Math.max(8, y)) };
  }

  function startDrag(e, id) {
    e.preventDefault();
    setDragId(id);
    setDragPos(posFromEvent(e));
  }
  function onFloorMove(e) {
    if (!dragId) return;
    e.preventDefault();
    setDragPos(posFromEvent(e));
  }
  function endDrag() {
    if (dragId && dragPos) {
      persist({
        ...plan,
        currentLayout: { ...plan.currentLayout, [zone]: savedTables.map((t) => (t.id === dragId ? { ...t, x: dragPos.x, y: dragPos.y } : t)) },
      });
    }
    setDragId(null);
    setDragPos(null);
  }

  const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="flex gap-3 mb-6">
        <button onClick={() => setZone("interieur")} className={`tap-scale flex-1 rounded-xl py-3 font-bold border-2 ${zone === "interieur" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>
          🏠 Intérieur
        </button>
        <button onClick={() => setZone("exterieur")} className={`tap-scale flex-1 rounded-xl py-3 font-bold border-2 ${zone === "exterieur" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>
          🌿 Extérieur
        </button>
        <button onClick={() => setZone("mangedebout")} className={`tap-scale flex-1 rounded-xl py-3 font-bold border-2 ${zone === "mangedebout" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>
          🧍 Mange-debout
        </button>
      </div>

      {isModified && (
        <div className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between" style={{ background: "#2c1c14", border: "1px solid #C0392B" }}>
          <span className="text-sm font-bold text-[#E8B23D]">Disposition modifiée pour ce service</span>
          <div className="flex gap-2">
            <button onClick={resetToDefault} className="tap-scale text-xs font-bold rounded-full px-3 py-2 border-2 border-[#3a2b1f]">
              ↩️ Revenir à la fixe
            </button>
            <button onClick={saveAsDefault} className="tap-scale text-xs font-bold rounded-full px-3 py-2" style={{ background: "#C0392B", color: "#fff5ea" }}>
              💾 Garder comme fixe
            </button>
          </div>
        </div>
      )}

      <p className="text-[#5a4a3a] text-xs mb-3">Glisse une table pour la repositionner. Un appui long ne supprime rien — utilise la petite croix.</p>

      <div
        ref={floorRef}
        onMouseMove={onFloorMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onTouchMove={onFloorMove}
        onTouchEnd={endDrag}
        className="relative w-full rounded-2xl mb-6 select-none"
        style={{
          height: "min(70vh, 520px)",
          background: "repeating-linear-gradient(0deg, #1a120b, #1a120b 39px, #241811 40px), repeating-linear-gradient(90deg, #1a120b, #1a120b 39px, #241811 40px)",
          border: "2px solid #3a2b1f",
          touchAction: "none",
        }}
      >
        {tables.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-[#5a4a3a] text-sm">Aucune table — ajoute-en une ci-dessous</div>}
        {tables.map((t) => (
          <div
            key={t.id}
            onMouseDown={(e) => startDrag(e, t.id)}
            onTouchStart={(e) => startDrag(e, t.id)}
            className="absolute flex flex-col items-center justify-center rounded-full cursor-grab active:cursor-grabbing"
            style={{
              left: `${t.x ?? 50}%`,
              top: `${t.y ?? 50}%`,
              transform: "translate(-50%, -50%)",
              width: 72,
              height: 72,
              background: dragId === t.id ? "#C0392B" : "#2c1c14",
              border: "2px solid #C0392B",
              boxShadow: dragId === t.id ? "0 8px 20px rgba(0,0,0,0.4)" : "none",
              zIndex: dragId === t.id ? 10 : 1,
            }}
          >
            <span className="display-font text-lg font-bold leading-none">{t.number}</span>
            <span className="text-[10px] text-[#a88f78] mt-0.5">{t.seats} pl.</span>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                removeTable(t.id);
              }}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-800 text-white text-xs font-bold flex items-center justify-center"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#3a2b1f] p-4">
        <div className="text-sm font-bold mb-3">+ Ajouter une table {zone === "interieur" ? "à l'intérieur" : zone === "exterieur" ? "en extérieur" : "en mange-debout"}</div>
        <div className="flex items-end gap-3">
          <div>
            <div className="text-xs text-[#a88f78] mb-1">N° table</div>
            <input value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder="Ex. 12" className="rounded-lg px-3 py-2 w-24" style={inputStyle} />
          </div>
          <div>
            <div className="text-xs text-[#a88f78] mb-1">Places</div>
            <input value={newSeats} onChange={(e) => setNewSeats(e.target.value)} type="number" className="rounded-lg px-3 py-2 w-20" style={inputStyle} />
          </div>
          <button onClick={addTable} className="tap-scale rounded-lg px-5 py-2 font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
            Ajouter
          </button>
        </div>
      </div>

      <p className="text-[#5a4a3a] text-xs mt-4">
        La disposition fixe reste inchangée tant que tu ne tapes pas sur "💾 Garder comme fixe". Pour un gros service, ajoute/déplace/retire des tables librement, puis reviens à la disposition normale ensuite.
      </p>
    </div>
  );
}
