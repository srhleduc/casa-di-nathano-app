"use client";

// En-tête d'un groupe de livraisons partant au même départ (voir
// lib/deliveryWaves.js) : heure, secteur, nombre de commandes, et — pour les
// commandes prêtes — un lien Google Maps multi-arrêts pour toute la tournée.

import { buildRouteUrl, sectorLabel } from "@/lib/deliveryWaves";

export default function WaveHeader({ group, readyOrders = [] }) {
  const route = buildRouteUrl(readyOrders);
  const n = group.orders.length;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
      <div className="font-bold" style={{ color: "#E8B23D" }}>
        {group.time ? `🕒 Départ ${group.time}` : "Sans départ"}
        {group.time && group.sector ? ` · ${sectorLabel(group.sector)}` : ""}
        <span className="text-[#a88f78] font-normal"> · {n} commande{n > 1 ? "s" : ""}</span>
      </div>
      {route && readyOrders.length > 0 && (
        <a href={route} target="_blank" rel="noopener noreferrer" className="tap-scale rounded-full px-4 py-2 text-sm font-bold" style={{ background: "#2b5a82", color: "#fff" }}>
          🗺️ Tournée complète{readyOrders.length > 1 ? ` (${Math.min(readyOrders.length, 10)} arrêts)` : ""}
        </a>
      )}
    </div>
  );
}
