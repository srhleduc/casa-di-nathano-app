"use client";

export default function AperoAskScreen({ onAnswer }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <span className="text-6xl mb-6">🍸</span>
      <h2 className="display-font text-4xl font-semibold mb-3">Un apéritif pour commencer ?</h2>
      <p className="mb-10" style={{ color: "var(--color-text-muted)" }}>On vous propose d'abord les boissons et planches, vos pizzas viendront juste après.</p>
      <div className="flex gap-5">
        <button onClick={() => onAnswer(true)} className="tap-scale rounded-full px-12 py-6 text-xl font-bold" style={{ background: "var(--color-accent)", color: "var(--color-text-alt)" }}>
          Oui, avec plaisir
        </button>
        <button onClick={() => onAnswer(false)} className="tap-scale rounded-full px-12 py-6 text-xl font-bold border-2" style={{ borderColor: "var(--color-border)" }}>
          Non, allons-y direct
        </button>
      </div>
    </div>
  );
}
