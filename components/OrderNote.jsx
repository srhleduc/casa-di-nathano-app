"use client";

// Note libre laissée par une serveuse à la prise de commande, au niveau de la
// commande entière (distincte des notes par article `it.itemNote`, affichées
// sous chaque produit par ItemLine, et des notes canoniques `it.note` en
// ambre). Affichée en rose bien visible, toujours en bas de la carte, sur
// tous les écrans équipe, précédée du libellé « Note de commande » pour ne
// pas la confondre avec une note d'article.
export default function OrderNote({ note }) {
  if (!note) return null;
  return (
    <div className="mt-2 pt-2 border-t border-[#3a2b1f]" style={{ color: "#ff5fa8" }}>
      <div className="text-[10px] font-bold uppercase tracking-wide opacity-70">Note de commande</div>
      <div className="text-xs font-bold">📝 {note}</div>
    </div>
  );
}
