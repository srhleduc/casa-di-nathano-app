"use client";

// Bandeau d'avertissement affiché quand l'ajout d'un produit "service
// midi/soir uniquement" est refusé car le panier contient déjà un produit de
// l'autre service (voir conflictingCartItem dans lib/business.js). Un seul
// créneau est réservé par commande, il ne peut pas couvrir les deux services.
export default function ServiceConflictBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div
      className="px-5 py-3 border-b text-sm font-bold flex items-center justify-between gap-3"
      style={{ borderColor: "#C0392B", background: "#2c1c14", color: "#ffb4a8" }}
    >
      <span>⚠️ {message}</span>
      <button
        onClick={onDismiss}
        className="tap-scale shrink-0 rounded-full px-3 py-1 text-xs font-bold border"
        style={{ borderColor: "#C0392B", color: "#ffb4a8" }}
      >
        OK
      </button>
    </div>
  );
}
