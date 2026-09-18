"use client";

// Carte produit de l'écran client (kiosque + click & collect). Volontairement
// séparée du rendu "équipe" de OrderScreen : ici chaque carte réserve toujours
// un bloc photo carré en haut, pour que la grille reste alignée que le produit
// ait une photo ou non.

import { eur } from "@/lib/menu";

// Icône pizza minimaliste affichée à la place de la photo quand il n'y en a pas.
function PizzaGlyph() {
  return (
    <svg viewBox="0 0 48 48" width="46" height="46" fill="none" aria-hidden="true">
      <path d="M24 5 L43 39 A44 44 0 0 1 5 39 Z" stroke="var(--color-client-accent-gold)" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="24" cy="19" r="2.5" fill="var(--color-client-accent-gold)" />
      <circle cx="17" cy="30" r="2.5" fill="var(--color-client-accent-gold)" />
      <circle cx="31" cy="30" r="2.5" fill="var(--color-client-accent-gold)" />
    </svg>
  );
}

export default function ProductCard({ item, inCart, onTap, onIncrement, onDecrement, isFallback }) {
  const description = Array.isArray(item.ingredients) && item.ingredients.length ? item.ingredients.join(", ") : null;
  const priceLabel = item.price === 0 ? "Offert" : eur(item.price);

  return (
    <div
      onClick={onTap}
      className={`tap-scale cursor-pointer text-left rounded-2xl overflow-hidden flex flex-col ${isFallback ? "border-2" : "border"}`}
      style={{ background: "var(--color-surface-card-alt)", borderColor: isFallback ? "var(--color-warning)" : "var(--color-client-border)" }}
    >
      {/* Bloc photo — toujours présent, ratio carré */}
      <div className="relative w-full" style={{ aspectRatio: "1 / 1" }}>
        {item.photoUrl ? (
          <img src={item.photoUrl} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "radial-gradient(circle at 50% 38%, var(--color-client-placeholder-from) 0%, var(--color-client-placeholder-to) 78%)" }}
          >
            <span style={{ opacity: 0.4 }}>
              <PizzaGlyph />
            </span>
          </div>
        )}

        {/* Fondu "croûte" : raccord de la photo vers le fond de la carte */}
        <div
          className="absolute inset-x-0 bottom-0 h-10 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, transparent 0%, var(--color-surface-card-alt) 100%)" }}
        />

        {/* Badge mise en avant (piloté depuis l'admin Menu) */}
        {item.featured && (
          <span
            className="absolute top-2 left-2 rounded-full px-2.5 py-1 font-bold"
            style={{
              fontSize: 11,
              background: "color-mix(in srgb, var(--color-client-bg) 72%, transparent)",
              border: "1px solid var(--color-client-accent)",
              color: "var(--color-client-text)",
            }}
          >
            ★ Best-seller
          </span>
        )}

        {/* Bouton d'ajout — chevauche photo et corps, masqué une fois au panier
            (le pas-à-pas du corps prend le relais). */}
        {inCart === 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTap();
            }}
            aria-label={`Ajouter ${item.name}`}
            className="tap-scale absolute flex items-center justify-center rounded-full font-bold"
            style={{
              width: 34,
              height: 34,
              right: 10,
              bottom: -14,
              background: "var(--color-client-accent)",
              color: "var(--color-client-accent-text)",
              fontSize: 20,
              lineHeight: 1,
              boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
            }}
          >
            +
          </button>
        )}
      </div>

      {/* Corps */}
      <div className="px-3.5 pt-4 pb-3.5 flex flex-col gap-1 flex-1">
        <span className="font-bold leading-snug" style={{ color: "var(--color-client-text)", fontSize: 15 }}>
          {item.name}
        </span>

        {isFallback && (
          <span className="font-bold" style={{ fontSize: 11, color: "var(--color-warning)" }}>
            🥡 Dépannage à emporter — stock sur place épuisé
          </span>
        )}

        {description && (
          <span
            className="leading-snug"
            style={{
              fontSize: 12,
              color: "var(--color-client-text-muted)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {description}
          </span>
        )}

        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 mt-auto pt-1">
          <span className="display-font italic whitespace-nowrap shrink-0" style={{ color: "var(--color-client-accent-gold)", fontSize: 18 }}>
            {priceLabel}
          </span>
          {inCart > 0 && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 rounded-full p-1 shrink-0"
              style={{ background: "var(--color-client-surface)", border: "1px solid var(--color-client-border)" }}
            >
              <button
                onClick={onDecrement}
                className="tap-scale w-6 h-6 rounded-full text-white text-sm font-bold flex items-center justify-center"
                style={{ background: "var(--color-client-border)" }}
              >
                −
              </button>
              <span className="text-sm font-bold w-4 text-center" style={{ color: "var(--color-client-text)" }}>
                {inCart}
              </span>
              <button
                onClick={onIncrement}
                className="tap-scale w-6 h-6 rounded-full text-sm font-bold flex items-center justify-center"
                style={{ background: "var(--color-client-accent)", color: "var(--color-client-accent-text)" }}
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
