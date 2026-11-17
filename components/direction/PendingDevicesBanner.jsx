"use client";

// Bandeau rose fluo en haut de l'espace Direction : un nouvel appareil a saisi le
// bon code équipe et attend d'être approuvé (voir supabase/migrations_manual/
// team_device_approval.sql). Rien ne s'affiche quand il n'y a aucune demande.
//
// Approuver (avec un prénom, facultatif mais conseillé) : l'appareil entre dès sa
// prochaine vérification (≈ 4 s) et, nommé, n'est plus « inconnu » dans le journal.
// Refuser : l'appareil est bloqué (liste « Appareils bloqués »).

import { useCallback, useEffect, useState } from "react";
import { fetchPendingTeamDevices, approveTeamDevice, refuseTeamDevice } from "@/lib/data";
import { useRestaurantsList } from "@/lib/restaurant";
import { deviceLabel } from "./TeamAccessLogAdmin";

const POLL_MS = 8000;

function formatWhen(iso) {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PendingDevicesBanner() {
  const restaurants = useRestaurantsList();
  const [pending, setPending] = useState([]);
  const [names, setNames] = useState({}); // { deviceId: prénom saisi }
  const [busy, setBusy] = useState(null); // deviceId en cours de traitement
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setPending(await fetchPendingTeamDevices());
    } catch (e) {
      console.error("[pending-devices]", e?.message || e);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  async function decide(deviceId, action) {
    setBusy(deviceId);
    setError("");
    try {
      if (action === "approve") await approveTeamDevice(deviceId, names[deviceId]);
      else await refuseTeamDevice(deviceId);
      setPending((list) => list.filter((d) => d.deviceId !== deviceId));
    } catch (e) {
      console.error(e);
      setError("Impossible d'enregistrer la décision, réessaie.");
    } finally {
      setBusy(null);
    }
  }

  if (pending.length === 0) return null;

  const restaurantName = (id) => restaurants.find((r) => r.id === id)?.name || id || "?";

  return (
    <div className="px-6 pt-4">
      {pending.map((d) => (
        <div
          key={d.deviceId}
          className="rounded-2xl p-4 mb-3 animate-pulse"
          style={{
            background: "#ff2d95",
            color: "#1a120b",
            boxShadow: "0 0 24px rgba(255, 45, 149, 0.65)",
            animationDuration: "2.4s",
          }}
        >
          <p className="font-extrabold text-lg">🔔 Demande d'approbation · nouvel appareil</p>
          <p className="font-bold mt-1">
            {d.number ? `Appareil inconnu ${d.number}` : "Appareil inconnu"} · espace {restaurantName(d.restaurantId)}
          </p>
          <p className="text-sm font-semibold mt-1">
            {deviceLabel(d.userAgent)}
            {d.city ? ` · ${d.city}` : ""}
            {d.ip ? ` · ${d.ip}` : ""} · demandé {formatWhen(d.requestedAt)}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <input
              value={names[d.deviceId] || ""}
              onChange={(e) => setNames((n) => ({ ...n, [d.deviceId]: e.target.value }))}
              placeholder="Prénom (facultatif)"
              maxLength={60}
              className="rounded-full px-4 py-2 font-semibold"
              style={{ background: "#fff5ea", color: "#1a120b", minWidth: 0, flex: "1 1 140px" }}
            />
            <button
              onClick={() => decide(d.deviceId, "approve")}
              disabled={busy === d.deviceId}
              className="tap-scale rounded-full px-5 py-2 font-extrabold"
              style={{ background: "#1a120b", color: "#fff5ea" }}
            >
              ✓ Approuver
            </button>
            <button
              onClick={() => decide(d.deviceId, "refuse")}
              disabled={busy === d.deviceId}
              className="tap-scale rounded-full px-5 py-2 font-extrabold border-2"
              style={{ borderColor: "#1a120b", color: "#1a120b" }}
            >
              ✕ Refuser
            </button>
          </div>
        </div>
      ))}
      {error && <p className="text-[#C0392B] text-sm font-bold">{error}</p>}
    </div>
  );
}
