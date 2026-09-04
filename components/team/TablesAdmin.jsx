"use client";

import { useMemo, useState } from "react";
import QRCode from "qrcode";
import { useTables, useOrders, addTable, setTableLabel, setTableActive, updateOrder } from "@/lib/data";
import { tableDisplayName, tableDisplayLabel, isTakeawayLike, isOrderPaid, isOrderActiveToday } from "@/lib/business";

// Le QR encode l'URL fixe du lien Service À Table (cahier des charges).
const SAT_BASE_URL = "https://casa-di-nathano-app.vercel.app/sat";

// "2" avant "10" (tri naturel), comme sortByTableName côté écrans équipe.
const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

function Row({ t, onRename, onToggle, onQr }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tableDisplayName(t));

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
      className="rounded-2xl border-2 p-4 flex items-center justify-between gap-4 flex-wrap"
      style={t.active ? { borderColor: "#3a2b1f" } : { borderColor: "#4a2020", background: "#2c1c14" }}
    >
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
        <div className="text-xs text-[#8a7561] mt-1 font-mono">QR : /sat?table={t.number}</div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onQr(t)} className="tap-scale rounded-full px-4 py-2 text-xs font-bold border-2 border-[#3a2b1f]">
          ⬇️ Télécharger QR
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
  );
}

export default function TablesAdmin() {
  const { tables } = useTables();
  const { orders } = useOrders();
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
        const newName = tableDisplayLabel({ tableIds: o.tableIds, tableLabel: o.tableLabel }, nextTables);
        if (newName !== o.name) updateOrder(o.id, { name: newName }).catch((e) => console.error(e));
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
        Le nom d'une table est libre (« T1 », « E3 » pour l'extérieur…) et modifiable à tout moment — clique dessus
        pour le changer. Le <span className="font-mono">code du QR</span> reste fixe : renommer une table ne casse pas
        les QR déjà imprimés. Désactive une table plutôt que de la supprimer.
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

      <div className="flex flex-col gap-3 max-w-xl">
        {sorted.map((t) => (
          <Row
            key={t.id}
            t={t}
            onRename={rename}
            onToggle={(x) => setTableActive(x.id, !x.active).catch((e) => console.error(e))}
            onQr={downloadQr}
          />
        ))}
      </div>
    </div>
  );
}
