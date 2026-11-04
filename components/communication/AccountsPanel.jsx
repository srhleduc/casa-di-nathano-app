"use client";

// Onglet « Comptes » : connexion à Facebook/Instagram (via Meta) et rattachement de chaque
// compte à une enseigne.

import { useState } from "react";
import { disconnectAccount, PLATFORM_LABELS, setAccountRestaurant, startMetaConnect } from "@/lib/communication";
import { useRestaurantsList } from "@/lib/restaurant";

const FIELD = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };

export default function AccountsPanel({ accounts, reload, notice }) {
  const restaurants = useRestaurantsList();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      await startMetaConnect();
    } catch (err) {
      console.error(err);
      setError(err.message || String(err));
      setBusy(false);
    }
  }

  async function assign(account, restaurantId) {
    try {
      await setAccountRestaurant(account.id, restaurantId);
      await reload();
    } catch (err) {
      console.error(err);
      setError(err.message || String(err));
    }
  }

  async function remove(account) {
    if (!window.confirm(`Déconnecter « ${account.name} » ? Les publications déjà faites ne sont pas supprimées.`)) return;
    try {
      await disconnectAccount(account.id);
      await reload();
    } catch (err) {
      console.error(err);
      setError(err.message || String(err));
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <p className="text-[#a88f78] text-sm mb-4 max-w-2xl">
        Connecte tes pages Facebook et comptes Instagram professionnels, puis indique à quelle enseigne appartient chacun.
        Les posts planifiés partiront automatiquement sur les comptes choisis.
      </p>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <button onClick={connect} disabled={busy} className="tap-scale rounded-full px-5 py-3 text-sm font-bold disabled:opacity-40"
          style={{ background: "#C0392B", color: "#fff5ea" }}>
          {busy ? "Redirection vers Facebook…" : accounts.length ? "🔄 Reconnecter / ajouter des comptes" : "🔗 Connecter Facebook et Instagram"}
        </button>
      </div>
      {notice && <p className={`text-sm mb-3 ${notice.kind === "error" ? "text-[#e88a8a]" : "text-[#7fb069]"}`}>{notice.text}</p>}
      {error && <p className="text-sm text-[#e88a8a] mb-3">{error}</p>}
      {accounts.length === 0 && <p className="text-sm text-[#8a7561]">Aucun compte connecté pour l'instant.</p>}

      <div className="flex flex-col gap-3 max-w-2xl">
        {accounts.map((a) => (
          <div key={a.id} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="font-bold">{a.name}</div>
                <div className="text-xs text-[#a88f78]">{PLATFORM_LABELS[a.platform]}</div>
              </div>
              {a.status === "error" && <span className="text-xs font-bold text-[#e88a8a]">⚠️ Connexion expirée — reconnecte</span>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select value={a.restaurantId || ""} onChange={(e) => assign(a, e.target.value)} className="rounded-xl px-3 py-2 text-sm outline-none" style={FIELD}>
                <option value="">Enseigne : à choisir</option>
                {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button onClick={() => remove(a)} className="text-xs font-bold underline text-[#e88a8a]">Déconnecter</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
