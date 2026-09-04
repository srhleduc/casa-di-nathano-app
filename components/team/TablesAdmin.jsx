"use client";

import { useMemo, useState } from "react";
import QRCode from "qrcode";
import { useTables, addTable, setTableActive } from "@/lib/data";

// Le QR encode l'URL fixe du lien Service À Table (cahier des charges).
const SAT_BASE_URL = "https://casa-di-nathano-app.vercel.app/sat";

// "2" avant "10" (tri naturel), comme sortByTableName côté écrans équipe.
const numberCollator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

export default function TablesAdmin() {
  const { tables } = useTables();
  const [newNumber, setNewNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const sorted = useMemo(
    () => [...tables].sort((a, b) => numberCollator.compare(a.number, b.number)),
    [tables]
  );

  async function create() {
    const n = newNumber.trim();
    if (!n || busy) return;
    if (tables.some((t) => t.number === n)) {
      setErr(`La table « ${n} » existe déjà.`);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await addTable(n);
      setNewNumber("");
    } catch (e) {
      console.error(e);
      setErr("Impossible d'ajouter la table.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadQr(number) {
    const url = `${SAT_BASE_URL}?table=${encodeURIComponent(number)}`;
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 720, margin: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `qr-table-${number}.png`;
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
        Les tables enregistrées ici alimentent le sélecteur de la prise de commande et le lien client{" "}
        <span className="font-mono">/sat?table=N</span> (QR posé sur la table). Désactive une table plutôt que de
        la supprimer — les commandes passées qui y sont liées restent intactes.
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-6 max-w-xl">
        <div className="flex-1 min-w-[160px]">
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-2">Numéro de table</div>
          <input
            value={newNumber}
            onChange={(e) => setNewNumber(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Ex. 12"
            className="w-full rounded-xl px-4 py-3 outline-none"
            style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
          />
        </div>
        <button
          onClick={create}
          disabled={busy || !newNumber.trim()}
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
          <div
            key={t.id}
            className="rounded-2xl border-2 p-4 flex items-center justify-between gap-4 flex-wrap"
            style={t.active ? { borderColor: "#3a2b1f" } : { borderColor: "#4a2020", background: "#2c1c14" }}
          >
            <div className="flex items-center gap-3">
              <span className="display-font text-xl font-bold">Table {t.number}</span>
              <span
                className="text-xs font-bold rounded-full px-3 py-1"
                style={t.active ? { background: "#204a3a", color: "#a8e8c8" } : { background: "#4a2020", color: "#e8a8a8" }}
              >
                {t.active ? "✓ Active" : "✕ Désactivée"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadQr(t.number)}
                className="tap-scale rounded-full px-4 py-2 text-xs font-bold border-2 border-[#3a2b1f]"
              >
                ⬇️ Télécharger QR
              </button>
              <button
                onClick={() => setTableActive(t.id, !t.active).catch((e) => console.error(e))}
                className="tap-scale rounded-full px-4 py-2 text-xs font-bold border-2"
                style={t.active ? { borderColor: "#4a2020", color: "#e8a8a8" } : { borderColor: "#204a3a", color: "#a8e8c8" }}
              >
                {t.active ? "Désactiver" : "Réactiver"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
