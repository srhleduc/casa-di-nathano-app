"use client";

// Écran « campagne » proposé au client du click & collect juste avant qu'il
// passe sa commande (voir TakeawayOrder.handleCheckoutConfirm), ex. vente de
// panettone pour Noël. Deux choix : réserver le produit lié avec la commande
// (quantité au choix) ou passer directement. Sans produit lié, c'est une
// simple annonce avec un seul bouton. Logique d'affichage : lib/campaigns.js.

import { useState } from "react";
import { eur } from "@/lib/menu";

const MAX_QTY = 10;

export default function CampaignModal({ campaign, item, onReserve, onSkip }) {
  const [qty, setQty] = useState(1);
  const imageUrl = campaign.imageUrl || item?.photoUrl || null;

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

            {item && (
              <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-[#3a2b1f] bg-[#211712] px-4 py-3">
                <div>
                  <div className="font-bold">{item.name}</div>
                  <div className="text-[#E8B23D] font-bold">{eur(item.price)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    aria-label="Moins"
                    className="tap-scale w-10 h-10 rounded-full bg-[#3a2b1f] text-xl font-bold disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-xl font-bold">{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
                    disabled={qty >= MAX_QTY}
                    aria-label="Plus"
                    className="tap-scale w-10 h-10 rounded-full bg-[#3a2b1f] text-xl font-bold disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-5 border-t border-[#3a2b1f] flex flex-col gap-3">
          {item ? (
            <>
              <button
                onClick={() => onReserve(qty)}
                className="tap-scale w-full rounded-full py-5 text-lg font-bold"
                style={{ background: "#e8622c", color: "#150e0a" }}
              >
                {campaign.reserveLabel} · {eur(item.price * qty)}
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
