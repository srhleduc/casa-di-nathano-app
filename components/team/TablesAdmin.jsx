"use client";

import { useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  useTables,
  useOrders,
  useRoomLayouts,
  addTable,
  setTableLabel,
  setTableActive,
  updateTable,
  updateOrder,
} from "@/lib/data";
import { tableDisplayName, tableDisplayLabel, isTakeawayLike, isOrderPaid, isOrderActiveToday } from "@/lib/business";

// Le QR encode l'URL fixe du lien Service À Table (cahier des charges).
const SAT_BASE_URL = "https://casa-di-nathano-app.vercel.app/sat";

// "2" avant "10" (tri naturel), comme sortByTableName côté écrans équipe.
const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

const CELL_TINT = { T: "#331526", P: "#16281c", S: "#241f3a", D: "#332a12", W: "#331d16", empty: "#1a120b" };

// Aperçu cliquable du plan pour poser l'ancre (case haut-gauche) d'une table.
function LayoutPicker({ layout, gridRow, gridCol, onPick }) {
  const cells = Array.isArray(layout?.cells) ? layout.cells : [];
  if (!cells.length) return <div className="text-xs text-[#5a4a3a]">Ce plan n'a pas encore de grille dessinée.</div>;
  const cols = cells[0]?.length || 0;
  return (
    <div className="overflow-auto rounded-lg border border-[#3a2b1f] p-2 inline-block">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, 14px)`, gap: 1 }}>
        {cells.map((row, r) =>
          row.map((code, c) => {
            const here = r === gridRow && c === gridCol;
            return (
              <div
                key={`${r}-${c}`}
                onClick={() => onPick(r, c)}
                title={`L${r + 1} · C${c + 1}`}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 2,
                  cursor: "pointer",
                  background: here ? "#C0392B" : CELL_TINT[code] || CELL_TINT.empty,
                  border: here ? "1px solid #fff5ea" : "1px solid #2a1f16",
                }}
              />
            );
          })
        )}
      </div>
    </div>
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

function ResaConfig({ t, others, layouts }) {
  const layout = layouts.find((l) => l.id === t.layoutId) || null;

  function setArr(field, id) {
    const cur = t[field] || [];
    let next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    const patch = { [field]: next };
    // "Jamais combinée" est exclusif des deux autres relations.
    if (field === "nonCombinableWith" && !cur.includes(id)) {
      patch.usuallyCombinedWith = (t.usuallyCombinedWith || []).filter((x) => x !== id);
      patch.combinableWith = (t.combinableWith || []).filter((x) => x !== id);
    }
    if ((field === "usuallyCombinedWith" || field === "combinableWith") && !cur.includes(id)) {
      patch.nonCombinableWith = (t.nonCombinableWith || []).filter((x) => x !== id);
    }
    updateTable(t.id, patch).catch((e) => console.error(e));
  }

  return (
    <div className="mt-3 pt-3 border-t border-[#3a2b1f]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-[#a88f78]">Couverts (table seule)</span>
        <input
          type="number"
          min={1}
          value={t.capacityBase}
          onChange={(e) => updateTable(t.id, { capacityBase: Math.max(1, parseInt(e.target.value, 10) || 1) }).catch((err) => console.error(err))}
          className="w-16 rounded-lg px-2 py-1 text-sm"
          style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
        />
      </div>

      <RelationRow label="Habituellement collée à" others={others} selected={t.usuallyCombinedWith || []} onToggle={(id) => setArr("usuallyCombinedWith", id)} />
      <RelationRow label="Peut être rapprochée de" others={others} selected={t.combinableWith || []} onToggle={(id) => setArr("combinableWith", id)} />
      <RelationRow label="Jamais combinée avec" others={others} selected={t.nonCombinableWith || []} onToggle={(id) => setArr("nonCombinableWith", id)} />

      <div className="mt-3">
        <div className="text-xs text-[#a88f78] mb-1">Position sur le plan</div>
        <div className="flex items-center gap-2 mb-2">
          <select
            value={t.layoutId || ""}
            onChange={(e) => updateTable(t.id, { layoutId: e.target.value || null, gridRow: null, gridCol: null }).catch((err) => console.error(err))}
            className="rounded-lg px-2 py-1 text-sm"
            style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
          >
            <option value="">Non placée</option>
            {layouts.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          {t.gridRow != null && (
            <>
              <span className="text-xs text-[#8a7561]">L{t.gridRow + 1} · C{t.gridCol + 1}</span>
              <button
                onClick={() => updateTable(t.id, { gridRow: null, gridCol: null }).catch((e) => console.error(e))}
                className="tap-scale text-xs text-red-400 font-bold"
              >
                retirer
              </button>
            </>
          )}
        </div>
        {layout && (
          <LayoutPicker
            layout={layout}
            gridRow={t.gridRow}
            gridCol={t.gridCol}
            onPick={(r, c) => updateTable(t.id, { gridRow: r, gridCol: c }).catch((e) => console.error(e))}
          />
        )}
      </div>
    </div>
  );
}

function Row({ t, others, layouts, onRename, onToggle, onQr }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tableDisplayName(t));
  const [open, setOpen] = useState(false);

  function commit() {
    const v = value.trim();
    setEditing(false);
    if (!v || v === tableDisplayName(t)) {
      setValue(tableDisplayName(t));
      return;
    }
    onRename(t, v);
  }

  return (
    <div
      className="rounded-2xl border-2 p-4 flex flex-col gap-2"
      style={t.active ? { borderColor: "#3a2b1f" } : { borderColor: "#4a2020", background: "#2c1c14" }}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
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
                className="display-font text-xl font-bold rounded-lg px-2 py-1 outline-none w-40"
                style={{ background: "#140d08", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
              />
            ) : (
              <button
                onClick={() => {
                  setValue(tableDisplayName(t));
                  setEditing(true);
                }}
                className="display-font text-xl font-bold tap-scale text-left"
              >
                {tableDisplayName(t)} <span className="text-sm text-[#8a7561]">✏️</span>
              </button>
            )}
            <span
              className="text-xs font-bold rounded-full px-3 py-1 shrink-0"
              style={t.active ? { background: "#204a3a", color: "#a8e8c8" } : { background: "#4a2020", color: "#e8a8a8" }}
            >
              {t.active ? "✓ Active" : "✕ Désactivée"}
            </span>
          </div>
          <div className="text-xs text-[#8a7561] mt-1 font-mono">
            QR : /sat?table={t.number} · {t.capacityBase} couv.
            {t.gridRow != null ? " · placée" : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen((v) => !v)}
            className="tap-scale rounded-full px-4 py-2 text-xs font-bold border-2"
            style={open ? { borderColor: "#C0392B", background: "#2c1c14", color: "#fff5ea" } : { borderColor: "#3a2b1f" }}
          >
            ⚙️ Config réservation
          </button>
          <button onClick={() => onQr(t)} className="tap-scale rounded-full px-4 py-2 text-xs font-bold border-2 border-[#3a2b1f]">
            ⬇️ QR
          </button>
          <button
            onClick={() => onToggle(t)}
            className="tap-scale rounded-full px-4 py-2 text-xs font-bold border-2"
            style={t.active ? { borderColor: "#4a2020", color: "#e8a8a8" } : { borderColor: "#204a3a", color: "#a8e8c8" }}
          >
            {t.active ? "Désactiver" : "Réactiver"}
          </button>
        </div>
      </div>

      {open && <ResaConfig t={t} others={others} layouts={layouts} />}
    </div>
  );
}

export default function TablesAdmin() {
  const { tables } = useTables();
  const { orders } = useOrders();
  const { layouts } = useRoomLayouts();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const sorted = useMemo(
    () => [...tables].sort((a, b) => collator.compare(tableDisplayName(a), tableDisplayName(b))),
    [tables]
  );

  async function create() {
    const n = newName.trim();
    if (!n || busy) return;
    if (tables.some((t) => t.number === n)) {
      setErr(`Une table « ${n} » existe déjà.`);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await addTable(n);
      setNewName("");
    } catch (e) {
      console.error(e);
      setErr("Impossible d'ajouter la table.");
    } finally {
      setBusy(false);
    }
  }

  async function rename(t, label) {
    setErr(null);
    try {
      await setTableLabel(t.id, label);
      // Répercute le nouveau nom sur les commandes sur place encore ouvertes
      // qui référencent cette table (leur `name` est un cache d'affichage).
      const nextTables = tables.map((x) => (x.id === t.id ? { ...x, label } : x));
      const openForTable = orders.filter(
        (o) =>
          !isTakeawayLike(o.serviceType) &&
          o.status !== "servie" &&
          !isOrderPaid(o) &&
          isOrderActiveToday(o) &&
          (o.tableIds || []).includes(t.id)
      );
      for (const o of openForTable) {
        const newNm = tableDisplayLabel({ tableIds: o.tableIds, tableLabel: o.tableLabel }, nextTables);
        if (newNm !== o.name) updateOrder(o.id, { name: newNm }).catch((e) => console.error(e));
      }
    } catch (e) {
      console.error(e);
      setErr("Renommage impossible.");
    }
  }

  async function downloadQr(t) {
    const url = `${SAT_BASE_URL}?table=${encodeURIComponent(t.number)}`;
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 720, margin: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `qr-${tableDisplayName(t).replace(/[^a-z0-9]+/gi, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error(e);
      setErr("Génération du QR impossible.");
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="text-xs text-[#8a7561] mb-5 max-w-xl">
        Nom de table libre et renommable (le code du QR reste fixe). « ⚙️ Config réservation » sur chaque table :
        couverts, tables habituellement collées / rapprochables / interdites, et position sur le plan de salle —
        ces réglages alimentent le moteur de réservation.
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-6 max-w-xl">
        <div className="flex-1 min-w-[160px]">
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-2">Nom de la table</div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Ex. T1, E3, 12"
            className="w-full rounded-xl px-4 py-3 outline-none"
            style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
          />
        </div>
        <button
          onClick={create}
          disabled={busy || !newName.trim()}
          className="tap-scale rounded-full px-6 py-3 font-bold disabled:opacity-40"
          style={{ background: "#C0392B", color: "#fff5ea" }}
        >
          + Ajouter une table
        </button>
      </div>

      {err && (
        <div className="text-sm mb-4" style={{ color: "#e88a8a" }}>
          {err}
        </div>
      )}

      {sorted.length === 0 && <p className="text-[#8a7561]">Aucune table enregistrée pour l'instant.</p>}

      <div className="flex flex-col gap-3 max-w-2xl">
        {sorted.map((t) => (
          <Row
            key={t.id}
            t={t}
            others={sorted.filter((x) => x.id !== t.id)}
            layouts={layouts}
            onRename={rename}
            onToggle={(x) => setTableActive(x.id, !x.active).catch((e) => console.error(e))}
            onQr={downloadQr}
          />
        ))}
      </div>
    </div>
  );
}
