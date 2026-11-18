"use client";

// Plan d'une tournée pour l'appli livreur : ordre des arrêts, position et temps
// avant chaque livraison. Affiche tout de suite une estimation à vol d'oiseau,
// puis la remplace par le calcul du service d'itinéraires (route /api/tournee)
// quand il répond. Voir lib/tournee.js.

import { useEffect, useMemo, useState } from "react";
import { planTournee, hasCoords } from "@/lib/tournee";
import { fetchRouteDurations } from "@/lib/data";

// Matrices déjà obtenues, par tournée : évite de réinterroger le service (1 requête
// par seconde maximum) à chaque rafraîchissement de l'écran.
const durationsCache = new Map();

export function useTourneePlan(origin, orders) {
  const stops = useMemo(
    () => (orders || []).filter((o) => hasCoords({ lat: o.deliveryLat, lng: o.deliveryLng })).map((o) => ({ id: o.id, lat: o.deliveryLat, lng: o.deliveryLng })),
    [orders]
  );
  const originKey = origin ? `${origin.lat},${origin.lng}` : "";
  const key = `${originKey}|${stops.map((s) => `${s.id}:${s.lat},${s.lng}`).join(";")}`;

  const [durations, setDurations] = useState(() => durationsCache.get(key) || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!origin || stops.length === 0) {
      setDurations(null);
      return;
    }
    if (durationsCache.has(key)) {
      setDurations(durationsCache.get(key));
      return;
    }
    setDurations(null);
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        // Même ordre que `stops` : la matrice est lue dans cet ordre par planTournee.
        const matrix = await fetchRouteDurations([origin, ...stops]);
        durationsCache.set(key, matrix);
        if (!cancelled) setDurations(matrix);
      } catch (err) {
        console.error("Itinéraires indisponibles, estimation utilisée :", err?.message || err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const plan = useMemo(() => (origin && stops.length ? planTournee({ origin, stops, durations }) : null), [originKey, key, durations]); // eslint-disable-line react-hooks/exhaustive-deps
  return { plan, loading };
}
