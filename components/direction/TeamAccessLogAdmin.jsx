"use client";

// Espace Direction → journal des saisies du code équipe : date, résultat, ville
// estimée, IP et appareil. Visible uniquement ici : la table team_pin_log n'est
// lisible que par un gérant (RLS is_manager()), l'espace équipe n'y a pas accès.
// La ville vient d'une géolocalisation par IP, donc approximative (surtout sur
// mobile) — à lire comme un indice, pas comme une preuve.
//
// Chaque navigateur envoie un identifiant aléatoire (voir getTeamDeviceId dans
// lib/data.js) : la Direction peut nommer un appareil (« Sarah », « Caisse
// Riec »…) puis ne garder que les appareils inconnus.

import { useEffect, useMemo, useState } from "react";
import { fetchTeamPinLog, fetchTeamDeviceNames, saveTeamDeviceName } from "@/lib/data";
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
  const [deviceNames, setDeviceNames] = useState({});
  const [error, setError] = useState(null);
  const [cityFilter, setCityFilter] = useState("");
  const [onlySuccess, setOnlySuccess] = useState(false);
  const [onlyUnknown, setOnlyUnknown] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null); // device_id en cours de nommage
  const [draftName, setDraftName] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setError(null);
    try {
      const [log, names] = await Promise.all([fetchTeamPinLog(300), fetchTeamDeviceNames()]);
      setRows(log);
      setDeviceNames(names);
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
      // « Inconnus » : appareil jamais nommé, ou sans identifiant (ancienne saisie).
      if (onlyUnknown && r.device_id && deviceNames[r.device_id]) return false;
      if (!q) return true;
      return [r.city, r.region, r.ip_address, deviceNames[r.device_id]].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [rows, cityFilter, onlySuccess, onlyUnknown, deviceNames]);

  function startNaming(deviceId) {
    setEditingDevice(deviceId);
    setDraftName(deviceNames[deviceId] || "");
    setError(null);
  }

  async function submitName(deviceId) {
    setSaving(true);
    setError(null);
    try {
      await saveTeamDeviceName(deviceId, draftName);
      setDeviceNames(await fetchTeamDeviceNames());
      setEditingDevice(null);
    } catch (err) {
      setError(err?.message || "Impossible d'enregistrer le nom.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <p className="text-[#a88f78] text-sm mb-4 max-w-2xl">
        Chaque saisie du code équipe (réussie ou ratée) avec la date, la ville estimée d'après l'adresse IP et
        l'appareil. Seule la Direction voit cette page. Le journal commence à la mise en service : les connexions
        antérieures n'ont laissé aucune trace. La ville est approximative, surtout sur téléphone. Nomme un appareil
        (« Nommer ») pour le reconnaître ensuite, même si son IP change ; un appareil sans nom ou dont les données du
        navigateur ont été effacées apparaît comme inconnu.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="text"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          placeholder="Filtrer par ville, IP ou nom (ex. Bannalec)"
          className="rounded-xl px-4 py-3 text-base outline-none flex-1 min-w-[220px] max-w-sm"
          style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
        />
        <button
          onClick={() => setOnlyUnknown((v) => !v)}
          className={`tap-scale rounded-full px-5 py-3 font-bold border-2 ${onlyUnknown ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}
        >
          Appareils inconnus
        </button>
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
        {filtered.map((r) => {
          const deviceName = r.device_id ? deviceNames[r.device_id] : null;
          const editing = r.device_id && editingDevice === r.device_id;
          return (
            <div
              key={r.id}
              className="rounded-xl px-4 py-3"
              style={{ background: "#211712", border: `1px solid ${r.success ? "#3a2b1f" : "#6b2a22"}` }}
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
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

              <div className="flex flex-wrap items-center gap-3 mt-2">
                {deviceName ? (
                  <span className="text-sm font-bold rounded-full px-3 py-1" style={{ background: "#2c1c14", border: "1px solid #5a4330" }}>
                    📱 {deviceName}
                  </span>
                ) : (
                  <span className="text-xs text-[#C0392B] font-bold">
                    {r.device_id ? "Appareil inconnu" : "Appareil non identifié"}
                  </span>
                )}
                {r.device_id && !editing && (
                  <button onClick={() => startNaming(r.device_id)} className="tap-scale text-xs font-bold underline text-[#a88f78]">
                    {deviceName ? "Renommer" : "Nommer"}
                  </button>
                )}
              </div>

              {editing && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="Nom (ex. Sarah, Caisse Riec)"
                    maxLength={60}
                    autoFocus
                    className="rounded-xl px-3 py-2 text-base outline-none flex-1 min-w-[180px]"
                    style={{ background: "#14100c", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
                  />
                  <button
                    onClick={() => submitName(r.device_id)}
                    disabled={saving}
                    className="tap-scale rounded-full px-5 py-2 font-bold disabled:opacity-50"
                    style={{ background: "#C0392B", color: "#fff5ea" }}
                  >
                    {saving ? "…" : "Enregistrer"}
                  </button>
                  <button onClick={() => setEditingDevice(null)} className="tap-scale text-sm text-[#8a7561]">
                    Annuler
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
