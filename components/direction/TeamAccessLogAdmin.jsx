"use client";

// Espace Direction → journal des saisies du code équipe : date, résultat, ville
// estimée, IP et appareil. Visible uniquement ici : la table team_pin_log n'est
// lisible que par un gérant (RLS is_manager()), l'espace équipe n'y a pas accès.
// La ville vient d'une géolocalisation par IP, donc approximative (surtout sur
// mobile) — à lire comme un indice, pas comme une preuve.

import { useEffect, useMemo, useState } from "react";
import { fetchTeamPinLog } from "@/lib/data";
import { useRestaurantsList } from "@/lib/restaurant";

function deviceLabel(ua) {
  if (!ua) return "Inconnu";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Macintosh|Mac OS X/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "Autre";
  const browser = /FxiOS|Firefox/.test(ua)
    ? "Firefox"
    : /CriOS|Chrome/.test(ua)
      ? "Chrome"
      : /Safari/.test(ua)
        ? "Safari"
        : "";
  return browser ? `${os} · ${browser}` : os;
}

function formatWhen(iso) {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TeamAccessLogAdmin() {
  const restaurants = useRestaurantsList();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [cityFilter, setCityFilter] = useState("");
  const [onlySuccess, setOnlySuccess] = useState(false);

  async function load() {
    setError(null);
    try {
      setRows(await fetchTeamPinLog(300));
    } catch (err) {
      setError(err?.message || "Impossible de charger le journal.");
      setRows([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const names = useMemo(() => Object.fromEntries(restaurants.map((r) => [r.id, r.name || r.id])), [restaurants]);

  const filtered = useMemo(() => {
    const q = cityFilter.trim().toLowerCase();
    return (rows || []).filter((r) => {
      if (onlySuccess && !r.success) return false;
      if (!q) return true;
      return [r.city, r.region, r.ip_address].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [rows, cityFilter, onlySuccess]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <p className="text-[#a88f78] text-sm mb-4 max-w-2xl">
        Chaque saisie du code équipe (réussie ou ratée) avec la date, la ville estimée d'après l'adresse IP et
        l'appareil. Seule la Direction voit cette page. Le journal commence à la mise en service : les connexions
        antérieures n'ont laissé aucune trace. La ville est approximative, surtout sur téléphone.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="text"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          placeholder="Filtrer par ville ou IP (ex. Bannalec)"
          className="rounded-xl px-4 py-3 text-base outline-none flex-1 min-w-[220px] max-w-sm"
          style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
        />
        <button
          onClick={() => setOnlySuccess((v) => !v)}
          className={`tap-scale rounded-full px-5 py-3 font-bold border-2 ${onlySuccess ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}
        >
          Réussies seulement
        </button>
        <button onClick={load} className="tap-scale rounded-full px-5 py-3 font-bold border-2 border-[#3a2b1f]">
          ↻ Actualiser
        </button>
      </div>

      {error && <p className="text-[#C0392B] text-sm font-bold mb-4">{error}</p>}
      {rows === null && <p className="text-sm text-[#8a7561]">Chargement…</p>}
      {rows !== null && !error && filtered.length === 0 && (
        <p className="text-sm text-[#8a7561]">
          {rows.length === 0 ? "Aucune saisie enregistrée pour l'instant." : "Aucune saisie ne correspond au filtre."}
        </p>
      )}

      <div className="flex flex-col gap-2 max-w-3xl">
        {filtered.map((r) => (
          <div
            key={r.id}
            className="rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1"
            style={{ background: "#211712", border: `1px solid ${r.success ? "#3a2b1f" : "#6b2a22"}` }}
          >
            <span className="text-sm font-bold w-36 shrink-0">{formatWhen(r.created_at)}</span>
            <span className={`text-sm font-bold ${r.success ? "text-[#7fb069]" : "text-[#C0392B]"}`}>
              {r.success ? "Réussie" : "Ratée"}
            </span>
            <span className="text-sm">
              {r.city ? `${r.city}${r.region ? ` (${r.region})` : ""}` : "Ville inconnue"}
            </span>
            <span className="text-sm text-[#a88f78]">{deviceLabel(r.user_agent)}</span>
            <span className="text-xs text-[#8a7561]">{r.ip_address || "IP inconnue"}</span>
            {restaurants.length > 1 && (
              <span className="text-xs text-[#8a7561] ml-auto">{names[r.restaurant_id] || r.restaurant_id}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
