"use client";

export default function WelcomeScreen({ onStart, onTeam, restaurantName, hoursNote }) {
  return (
    <div className="relative flex-1 flex flex-col items-center justify-center px-8 text-center">
      <div className="oven-glow" />
      <div className="relative z-10 flex flex-col items-center">
        <span className="text-7xl mb-6">🌿</span>
        <h1 className="display-font text-6xl font-semibold tracking-tight mb-3">{restaurantName}</h1>
        <p className="text-xl mb-3" style={{ color: "var(--color-text-subtle)" }}>Pizza façonnée à la main, four à bois, tous les jours.</p>
        {hoursNote && (
          <p className="text-sm font-bold rounded-full px-4 py-2 mb-10" style={{ background: "var(--color-surface-alt)", color: "var(--color-accent-gold)" }}>
            🕐 Aujourd&apos;hui : {hoursNote}
          </p>
        )}
        {!hoursNote && <div className="mb-11" />}
        <button
          onClick={onStart}
          className="tap-scale rounded-full px-16 py-7 text-2xl font-bold display-font italic"
          style={{
            background: "var(--color-accent)",
            color: "var(--color-text-alt)",
            boxShadow: "0 12px 30px color-mix(in srgb, var(--color-accent) 35%, transparent)",
          }}
        >
          Commencer ma commande
        </button>
        <p className="text-sm mt-8 tracking-wide uppercase" style={{ color: "var(--color-text-faint)" }}>Paiement en caisse après validation</p>
      </div>
      {onTeam && (
        <button onClick={onTeam} className="absolute bottom-6 right-6 text-xs tap-scale" style={{ color: "var(--color-text-dim)" }}>
          Espace équipe
        </button>
      )}
    </div>
  );
}
