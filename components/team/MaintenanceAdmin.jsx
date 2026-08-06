"use client";

import { useState } from "react";
import { useOrders, deleteOrders, useTeamPin, setTeamPin } from "@/lib/data";
import { isOrderFromPastAndStale } from "@/lib/business";

export default function MaintenanceAdmin() {
  const { orders } = useOrders();
  const [confirming, setConfirming] = useState(false);
  const staleOrders = orders.filter(isOrderFromPastAndStale);
  const keptCount = orders.length - staleOrders.length;

  function clearOldOrders() {
    deleteOrders(staleOrders.map((o) => o.id)).catch((err) => console.error(err));
    setConfirming(false);
  }

  const { pin } = useTeamPin();
  const [newPin, setNewPin] = useState("");
  const [pinSaved, setPinSaved] = useState(false);

  function savePin() {
    if (!/^\d{4}$/.test(newPin)) return;
    setTeamPin(newPin)
      .then(() => {
        setPinSaved(true);
        setNewPin("");
        setTimeout(() => setPinSaved(false), 2000);
      })
      .catch((err) => console.error(err));
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="rounded-2xl border border-[#3a2b1f] p-5 mb-6">
        <div className="font-bold mb-2">🔑 Code d'accès équipe</div>
        <p className="text-[#a88f78] text-sm mb-4">
          Code actuel : <span className="text-[#E8B23D] font-bold">{pin}</span>
        </p>
        <div className="flex items-center gap-3">
          <input
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="Nouveau code à 4 chiffres"
            className="rounded-lg px-3 py-3 w-48"
            style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
          />
          <button
            onClick={savePin}
            disabled={!/^\d{4}$/.test(newPin)}
            className="tap-scale rounded-lg px-4 py-3 font-bold text-sm disabled:opacity-40"
            style={{ background: "#C0392B", color: "#fff5ea" }}
          >
            Enregistrer
          </button>
          {pinSaved && <span className="text-sm text-[#E8B23D] font-bold">✓ Code mis à jour</span>}
        </div>
      </div>

      <div className="rounded-2xl border border-[#3a2b1f] p-5">
        <div className="font-bold mb-2">🗑️ Vider le cache des anciennes commandes</div>
        <p className="text-[#a88f78] text-sm mb-4">
          Les commandes des jours précédents sont normalement nettoyées automatiquement chaque nuit. Ce bouton reste disponible en
          secours : il supprime uniquement les commandes qui ne concernent plus ni aujourd'hui, ni une date à venir — les commandes
          du jour et les commandes programmées restent intactes.
        </p>

        <div className="rounded-xl bg-[#211712] px-4 py-3 mb-4 text-sm">
          <span className="text-[#E8B23D] font-bold">{staleOrders.length}</span> commande{staleOrders.length > 1 ? "s" : ""} à supprimer
          {" · "}
          <span className="text-[#c9b8a4]">{keptCount}</span> conservée{keptCount > 1 ? "s" : ""} (aujourd'hui / programmées)
        </div>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            disabled={staleOrders.length === 0}
            className="tap-scale w-full rounded-xl py-4 font-bold disabled:opacity-40"
            style={{ background: "#C0392B", color: "#fff5ea" }}
          >
            Vider le cache
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-bold text-[#E8B23D]">
              Confirmer la suppression définitive de {staleOrders.length} commande{staleOrders.length > 1 ? "s" : ""} ?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirming(false)} className="tap-scale flex-1 rounded-xl py-3 font-bold border-2 border-[#3a2b1f]">
                Annuler
              </button>
              <button onClick={clearOldOrders} className="tap-scale flex-1 rounded-xl py-3 font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
                Oui, supprimer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
