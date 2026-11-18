"use client";

// Choix de l'application GPS du livreur (Google Maps, Waze, Plans, ou le choix
// du téléphone). Mémorisé sur l'appareil — voir lib/navApps.js.

import { useEffect, useState } from "react";
import { NAV_APPS, DEFAULT_NAV_APP, NAV_APP_STORAGE_KEY, isValidNavApp, detectPlatform } from "@/lib/navApps";

export function useNavApp() {
  const [app, setAppState] = useState(DEFAULT_NAV_APP);
  const [platform, setPlatform] = useState("other");

  useEffect(() => {
    setPlatform(detectPlatform(typeof navigator !== "undefined" ? navigator.userAgent : ""));
    try {
      const saved = window.localStorage.getItem(NAV_APP_STORAGE_KEY);
      if (isValidNavApp(saved)) setAppState(saved);
    } catch {
      // stockage indisponible : on garde Google Maps
    }
  }, []);

  function setApp(key) {
    if (!isValidNavApp(key)) return;
    setAppState(key);
    try {
      window.localStorage.setItem(NAV_APP_STORAGE_KEY, key);
    } catch {
      // le choix reste valable jusqu'à la fermeture de la page
    }
  }

  return { app, setApp, platform };
}

export default function NavAppPicker({ app, setApp }) {
  return (
    <div className="mb-4">
      <div className="text-xs font-bold uppercase tracking-wide text-[#a88f78] mb-2">🧭 Application GPS</div>
      <div className="flex flex-wrap gap-2">
        {NAV_APPS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setApp(a.key)}
            className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2"
            style={app === a.key ? { borderColor: "#C0392B", background: "#2c1c14" } : { borderColor: "#3a2b1f" }}
          >
            {a.label}
          </button>
        ))}
      </div>
      {app !== "google" && (
        <p className="text-xs text-[#8a7561] mt-2">Seul Google Maps ouvre toute la tournée d&apos;un coup. Avec ce choix, le bouton de tournée ouvre le premier arrêt.</p>
      )}
    </div>
  );
}
