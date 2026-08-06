"use client";

export default function WelcomeScreen({ onStart, onTeam }) {
  return (
    <div className="relative flex-1 flex flex-col items-center justify-center px-8 text-center">
      <div className="oven-glow" />
      <div className="relative z-10 flex flex-col items-center">
        <span className="text-7xl mb-6">🌿</span>
        <h1 className="display-font text-6xl font-semibold tracking-tight mb-3">Casa Di Nathano</h1>
        <p className="text-[#c9b8a4] text-xl mb-14">Pizza façonnée à la main, four à bois, tous les jours.</p>
        <button
          onClick={onStart}
          className="tap-scale rounded-full px-16 py-7 text-2xl font-bold display-font italic"
          style={{ background: "#C0392B", color: "#fff5ea", boxShadow: "0 12px 30px rgba(192,57,43,0.35)" }}
        >
          Commencer ma commande
        </button>
        <p className="text-[#8a7561] text-sm mt-8 tracking-wide uppercase">Paiement en caisse après validation</p>
      </div>
      <button onClick={onTeam} className="absolute bottom-6 right-6 text-[#5a4a3a] text-xs tap-scale">
        Espace équipe
      </button>
    </div>
  );
}
