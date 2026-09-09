"use client";

// Note libre d'une réservation, affichée en rose vif (même convention que
// OrderNote pour les commandes). Simple affichage — l'édition est propre à
// chaque écran (board équipe / /reserver).
export default function ResaNote({ note, className = "" }) {
  if (!note) return null;
  return (
    <span className={`text-xs font-bold ${className}`} style={{ color: "#ff5fa8" }}>
      📝 {note}
    </span>
  );
}
