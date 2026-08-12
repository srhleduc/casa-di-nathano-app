"use client";

// Note libre laissée par une serveuse à la prise de commande (distincte des
// notes par article) — affichée en rose bien visible, en bas de la carte,
// sur tous les écrans équipe.
export default function OrderNote({ note }) {
  if (!note) return null;
  return (
    <div className="text-xs font-bold mt-2 pt-2 border-t border-[#3a2b1f]" style={{ color: "#ff5fa8" }}>
      📝 {note}
    </div>
  );
}
