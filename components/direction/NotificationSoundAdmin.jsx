"use client";

// Espace Direction → son de notification "commande autonome" (voir
// components/TeamSpace.jsx et lib/sound.js). Par défaut un carillon généré en
// direct ; chaque établissement peut importer son propre fichier son ici.

import { useRef, useState } from "react";
import { useRestaurantsList } from "@/lib/restaurant";
import { uploadNotificationSound, updateRestaurantNotificationSoundUrl } from "@/lib/data";

const PRIMARY_BTN = { background: "#C0392B", color: "#fff5ea" };
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

export default function NotificationSoundAdmin() {
  const restaurants = useRestaurantsList();

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <p className="text-[#a88f78] text-sm mb-6 max-w-2xl">
        Son joué sur les écrans équipe quand une commande autonome (click &amp; collect ou ajout depuis une table via /sat)
        est passée, pour ne pas la manquer. Par défaut, un carillon généré automatiquement. Fichier .mp3 / .wav / .ogg,
        2 Mo maximum — un son court (1 à 2 secondes) est préférable.
      </p>

      <div className="flex flex-col gap-4 max-w-2xl">
        {restaurants.length === 0 && <p className="text-sm text-[#8a7561]">Chargement…</p>}
        {restaurants.map((r) => (
          <RestaurantSoundRow key={r.id} restaurant={r} />
        ))}
      </div>
    </div>
  );
}

function RestaurantSoundRow({ restaurant }) {
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setError("Ce fichier n'est pas un son.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("Fichier trop volumineux (2 Mo maximum).");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const url = await uploadNotificationSound(file);
      await updateRestaurantNotificationSoundUrl(restaurant.id, url);
      setStatus("ok");
    } catch (err) {
      console.error(err);
      setError(`Échec de l'import : ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  }

  async function resetToDefault() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await updateRestaurantNotificationSoundUrl(restaurant.id, null);
      setStatus("ok");
    } catch (err) {
      console.error(err);
      setError("Échec.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
      <div className="font-bold mb-3">{restaurant.name}</div>
      <div className="flex flex-wrap items-center gap-3">
        {restaurant.notificationSoundUrl ? (
          <audio key={restaurant.notificationSoundUrl} controls src={restaurant.notificationSoundUrl} className="h-9" />
        ) : (
          <span className="text-xs text-[#8a7561]">Carillon par défaut (aucun fichier importé)</span>
        )}
        <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileChange} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="tap-scale rounded-full px-4 py-2 text-xs font-bold disabled:opacity-40"
          style={PRIMARY_BTN}
        >
          {restaurant.notificationSoundUrl ? "Remplacer le fichier" : "Importer un fichier"}
        </button>
        {restaurant.notificationSoundUrl && (
          <button
            onClick={resetToDefault}
            disabled={busy}
            className="tap-scale rounded-full px-4 py-2 text-xs font-bold border-2 border-[#3a2b1f] disabled:opacity-40"
          >
            Revenir au carillon par défaut
          </button>
        )}
        {status === "ok" && <span className="text-xs text-[#7fb069]">✓ enregistré</span>}
        {error && <span className="text-xs text-[#e88a8a]">{error}</span>}
      </div>
    </div>
  );
}
