"use client";

export default function WelcomeScreen({ onStart, onStartDelivery, onTeam, restaurantName, hoursNote }) {
  return (
    <div className="relative flex-1 flex flex-col items-center justify-center px-8 text-center">
      <div className="oven-glow" />
      <div className="relative z-10 flex flex-col items-center">
        <span className="text-7xl mb-6">🌿</span>
        <h1 className="display-font text-6xl font-semibold tracking-tight mb-3">{restaurantName}</h1>
        <p className="text-[#c9b8a4] text-xl mb-3">Pizza façonnée à la main, four à bois, tous les jours.</p>
        {hoursNote && (
          <p className="text-sm font-bold rounded-full px-4 py-2 mb-10" style={{ background: "#2c1c14", color: "#E8B23D" }}>
            🕐 Aujourd&apos;hui : {hoursNote}
          </p>
        )}
        {!hoursNote && <div className="mb-11" />}
        <button
          onClick={onStart}
          className="tap-scale rounded-full px-16 py-7 text-2xl font-bold display-font italic"
          style={{ background: "#C0392B", color: "#fff5ea", boxShadow: "0 12px 30px rgba(192,57,43,0.35)" }}
        >
          {onStartDelivery ? "Je viens la chercher" : "Commencer ma commande"}
        </button>
        {onStartDelivery && (
          <button
            onClick={onStartDelivery}
            className="tap-scale rounded-full px-16 py-6 text-2xl font-bold display-font italic mt-4"
            style={{ background: "transparent", color: "#E8B23D", border: "2px solid #E8B23D" }}
          >
            🛵 Me faire livrer
          </button>
        )}
        <p className="text-[#8a7561] text-sm mt-8 tracking-wide uppercase">
          {onStartDelivery ? "Paiement en caisse, ou au livreur" : "Paiement en caisse après validation"}
        </p>
      </div>
      {onTeam && (
        <button onClick={onTeam} className="absolute bottom-6 right-6 text-[#5a4a3a] text-xs tap-scale">
          Espace équipe
        </button>
      )}
    </div>
  );
}
