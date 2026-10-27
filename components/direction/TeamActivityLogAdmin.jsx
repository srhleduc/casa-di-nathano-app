"use client";

// Espace Direction → journal d'activité : qui (quel appareil, quelle IP) a ajouté,
// modifié ou supprimé quoi. Alimenté par des triggers en base (voir
// supabase/migrations_manual/team_activity_log.sql), conservé 90 jours, lisible
// uniquement par la Direction.
//
// Un appareil n'a d'identifiant qu'après une saisie du code équipe, et il change
// si le navigateur est vidé : « appareil » ne veut pas dire « personne ». Les
// noms et numéros viennent de l'onglet « Connexions équipe ».

import { useEffect, useMemo, useState } from "react";
import { fetchTeamActivityLog, fetchTeamDeviceNames, fetchTeamDeviceNumbers } from "@/lib/data";

const TABLE_LABELS = {
  orders: "Commande",
  reservations: "Réservation",
  ruptures: "Rupture",
  pizza_stock: "Stock pizzas",
  dessert_stock: "Stock desserts",
  menu_items: "Carte",
  takeaway_hours: "Horaires à emporter",
  online_booking_closures: "Fermeture réservations en ligne",
  pointage_corrections: "Correction de pointage",
  staff: "Équipe",
  service_overrides: "Service (exception)",
  service_exceptions: "Service (jour exceptionnel)",
  reservation_settings: "Réglages réservation",
  appro_stock_movements: "Mouvement de stock",
};

const OP_LABELS = { INSERT: "Ajout", UPDATE: "Modification", DELETE: "Suppression" };
const OP_COLORS = { INSERT: "text-[#7fb069]", UPDATE: "text-[#e0a030]", DELETE: "text-[#C0392B]" };

// Champs les plus parlants à montrer d'un ajout / d'une suppression.
const SUMMARY_KEYS = ["name", "customer_name", "status", "total", "item", "product", "qty", "price", "note"];

function formatWhen(iso) {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function summarize(row) {
  const c = row.changes || {};
  if (row.operation === "UPDATE") {
    return Object.entries(c)
      .slice(0, 6)
      .map(([k, v]) => `${k} : ${v?.old ?? "∅"} → ${v?.new ?? "∅"}`)
      .join(" · ");
  }
  const keys = SUMMARY_KEYS.filter((k) => c[k] != null && c[k] !== "");
  const shown = keys.length > 0 ? keys : Object.keys(c).filter((k) => k !== "id" && k !== "restaurant_id").slice(0, 3);
  return shown.map((k) => `${k} : ${c[k]}`).join(" · ");
}

export default function TeamActivityLogAdmin() {
  const [rows, setRows] = useState(null);
  const [deviceNames, setDeviceNames] = useState({});
  const [deviceNumbers, setDeviceNumbers] = useState({});
  const [error, setError] = useState(null);
  const [deviceFilter, setDeviceFilter] = useState("");
  const [tableFilter, setTableFilter] = useState("");

  async function load() {
    setError(null);
    try {
      const [log, names, numbers] = await Promise.all([
        fetchTeamActivityLog(500),
        fetchTeamDeviceNames(),
        fetchTeamDeviceNumbers(),
      ]);
      setRows(log);
      setDeviceNames(names);
      setDeviceNumbers(numbers);
    } catch (err) {
      setError(err?.message || "Impossible de charger le journal d'activité.");
      setRows([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function deviceLabel(r) {
    if (!r.device_id) return r.is_manager ? "Direction (sans appareil)" : "Appareil non identifié";
    if (deviceNames[r.device_id]) return deviceNames[r.device_id];
    return `Appareil inconnu ${deviceNumbers[r.device_id] ?? ""}`.trim();
  }

  const filtered = useMemo(() => {
    const q = deviceFilter.trim().toLowerCase();
    return (rows || []).filter((r) => {
      if (tableFilter && r.table_name !== tableFilter) return false;
      if (!q) return true;
      return [deviceLabel(r), r.ip_address, r.device_id].some((v) => (v || "").toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, deviceFilter, tableFilter, deviceNames, deviceNumbers]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <p className="text-[#a88f78] text-sm mb-3 max-w-2xl">
        Chaque ajout, modification ou suppression faite depuis un appareil de l'équipe ou la Direction : quel appareil,
        quelle IP, quelle donnée. Conservé 90 jours. Un appareil n'a d'identifiant qu'après une saisie du code équipe
        (et il change si le navigateur est vidé) : il identifie un téléphone, pas la personne qui le tenait. Les noms
        viennent de l'onglet « Connexions équipe ».
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="text"
          value={deviceFilter}
          onChange={(e) => setDeviceFilter(e.target.value)}
          placeholder="Filtrer par appareil ou IP (ex. Appareil inconnu 1)"
          className="rounded-xl px-4 py-3 text-base outline-none flex-1 min-w-[220px] max-w-sm"
          style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
        />
        <select
          value={tableFilter}
          onChange={(e) => setTableFilter(e.target.value)}
          className="rounded-xl px-4 py-3 text-base outline-none"
          style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
        >
          <option value="">Toutes les données</option>
          {Object.entries(TABLE_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <button onClick={load} className="tap-scale rounded-full px-5 py-3 font-bold border-2 border-[#3a2b1f]">
          ↻ Actualiser
        </button>
      </div>

      {error && <p className="text-[#C0392B] text-sm font-bold mb-4">{error}</p>}
      {rows === null && <p className="text-sm text-[#8a7561]">Chargement…</p>}
      {rows !== null && !error && filtered.length === 0 && (
        <p className="text-sm text-[#8a7561]">
          {rows.length === 0 ? "Aucune activité enregistrée pour l'instant." : "Aucune activité ne correspond au filtre."}
        </p>
      )}

      <div className="flex flex-col gap-2 max-w-3xl">
        {filtered.map((r) => {
          const text = summarize(r);
          return (
            <div key={r.id} className="rounded-xl px-4 py-3" style={{ background: "#211712", border: "1px solid #3a2b1f" }}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-sm font-bold w-44 shrink-0">{formatWhen(r.created_at)}</span>
                <span className={`text-sm font-bold ${OP_COLORS[r.operation] || ""}`}>{OP_LABELS[r.operation] || r.operation}</span>
                <span className="text-sm">{TABLE_LABELS[r.table_name] || r.table_name}</span>
                <span className="text-xs text-[#8a7561]">{r.ip_address || "IP inconnue"}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <span
                  className="text-sm font-bold rounded-full px-3 py-1"
                  style={{ background: "#2c1c14", border: "1px solid #5a4330" }}
                >
                  📱 {deviceLabel(r)}
                </span>
                {text && <span className="text-xs text-[#a88f78] break-words min-w-0">{text}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
