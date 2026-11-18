"use client";

import { eur } from "@/lib/menu";

// Bon de réduction offert au client (voucher_by_phone.sql) : déjà déduit du
// total de la commande à la validation en ligne. Bandeau vert fluo, très
// visible, sur toutes les vignettes équipe (en haut de OrderCardHeader) : la
// caisse (L'Addition) encaisse les articles au prix plein, il faut donc
// penser à retirer le bon. Le motif (erreur de commande, insatisfaction…) est
// interne et n'est jamais montré au client.
export default function OrderVoucher({ order }) {
  if (!order?.voucherAmount || order.voucherAmount <= 0) return null;
  return (
    <div
      className="w-full rounded-lg px-3 py-2 mb-2"
      style={{ background: "#12e08a", color: "#052a1a", border: "2px solid #0a9c61" }}
      role="note"
    >
      <div className="text-sm font-extrabold uppercase tracking-wide">
        🎁 Bon client −{eur(order.voucherAmount)} · à déduire en caisse
      </div>
      <div className="text-xs font-bold">
        Net à payer : {eur(order.total)}
        {order.voucherNote ? ` · ${order.voucherNote}` : ""}
      </div>
    </div>
  );
}
