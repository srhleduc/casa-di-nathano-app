"use client";

// Espace Direction → Services : mêmes horaires/jours de fermeture par
// établissement que l'écran équipe (components/team/ServicesAdmin.jsx,
// zone "Tables / Réservation" → onglet "Services"), réutilisé tel quel ici
// pour ne pas dupliquer la logique — seul le sélecteur d'établissement est
// nouveau. Pilote à la fois les créneaux de réservation ET les créneaux
// click & collect (voir supabase/functions/generate-daily-slots).

import { useState } from "react";
import { RestaurantFilterContext, useRestaurantsList } from "@/lib/restaurant";
import ServicesAdmin from "../team/ServicesAdmin";

export default function ServicesDirectionAdmin() {
  const restaurants = useRestaurantsList();
  const [restaurantId, setRestaurantId] = useState(null);
  const current = restaurantId || restaurants[0]?.id || null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex gap-3 px-6 pt-6 pb-2">
        {restaurants.map((r) => (
          <button
            key={r.id}
            onClick={() => setRestaurantId(r.id)}
            className={`tap-scale rounded-full px-5 py-2 font-bold border-2 ${current === r.id ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}
          >
            {r.name}
          </button>
        ))}
      </div>
      {current && (
        <RestaurantFilterContext.Provider value={current}>
          <ServicesAdmin />
        </RestaurantFilterContext.Provider>
      )}
    </div>
  );
}
