"use client";

// Écran « campagne » proposé au client du click & collect juste avant qu'il
// passe sa commande (voir TakeawayOrder.continueFromCheckout), ex. vente de
// panettone pour Noël. Deux choix : réserver un ou plusieurs des produits liés
// avec la commande (quantité au choix pour chacun) ou passer directement.
// Sans produit lié, c'est une simple annonce avec un seul bouton. Logique
// d'affichage : lib/campaigns.js.

import { useState } from "react";
import { eur } from "@/lib/menu";

const MAX_QTY = 10;

export default function CampaignModal({ campaign, items, onReserve, onSkip }) {
  // Un seul produit : on part de 1 (réserver = oui, par défaut). Plusieurs
  // produits : on part de 0, le client choisit ceux qu'il veut.
  const [qtys, setQtys] = useState(() => (items.length === 1 ? { [items[0].id]: 1 } : {}));
  const qtyOf = (id) => qtys[id] || 0;
  const setQty = (id, q) => setQtys((cur) => ({ ...cur, [id]: Math.max(0, Math.min(MAX_QTY, q)) }));

  const hasItems = items.length > 0;
  const total = items.reduce((s, it) => s + it.price * qtyOf(it.id), 0);
  const selection = items.filter((it) => qtyOf(it.id) > 0).map((it) => ({ id: it.id, qty: qtyOf(it.id) }));
  const imageUrl = campaign.imageUrl || (items.length === 1 ? items[0].photoUrl : null) || null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70">
      <div
        className="w-full md:max-w-lg md:rounded-3xl overflow-hidden flex flex-col"
        style={{ background: "#1a120b", color: "#f5ebdd", maxHeight: "92vh" }}
      >
        <div className="flex-1 overflow-y-auto">
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={campaign.title} className="w-full object-cover" style={{ maxHeight: "36vh" }} />
          )}

          <div className="px-6 py-5">
            <div className="display-font text-2xl font-bold mb-2">{campaign.title}</div>
            {campaign.description && <p className="text-[#c9b8a4] text-base whitespace-pre-line">{campaign.description}</p>}

            {hasItems && (
              <div className="mt-5 flex flex-col gap-3">
                {items.map((item) => {
                  const q = qtyOf(item.id);
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#3a2b1f] bg-[#211712] px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {items.length > 1 && item.photoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.photoUrl} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-bold">{item.name}</div>
                          <div className="text-[#E8B23D] font-bold">{eur(item.price)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={() => setQty(item.id, q - 1)}
                          disabled={q <= 0}
                          aria-label={`Moins de ${item.name}`}
                          className="tap-scale w-10 h-10 rounded-full bg-[#3a2b1f] text-xl font-bold disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-xl font-bold">{q}</span>
                        <button
                          onClick={() => setQty(item.id, q + 1)}
                          disabled={q >= MAX_QTY}
                          aria-label={`Plus de ${item.name}`}
                          className="tap-scale w-10 h-10 rounded-full bg-[#3a2b1f] text-xl font-bold disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-5 border-t border-[#3a2b1f] flex flex-col gap-3">
          {hasItems ? (
            <>
              <button
                onClick={() => onReserve(selection)}
                disabled={selection.length === 0}
                className="tap-scale w-full rounded-full py-5 text-lg font-bold disabled:opacity-40"
                style={{ background: "#e8622c", color: "#150e0a" }}
              >
                {campaign.reserveLabel}
                {selection.length > 0 ? ` · ${eur(total)}` : ""}
              </button>
              <button onClick={onSkip} className="tap-scale w-full rounded-full py-4 text-base font-bold border-2 border-[#4a3826] text-[#c9b8a4]">
                {campaign.skipLabel}
              </button>
            </>
          ) : (
            <button onClick={onSkip} className="tap-scale w-full rounded-full py-5 text-lg font-bold" style={{ background: "#e8622c", color: "#150e0a" }}>
              {campaign.skipLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
