"use client";

import { useEffect, useRef, useState } from "react";
import { canonicalLoyaltyPhone } from "@/lib/business";
import { fetchLoyaltyCustomerByPhone, searchLoyaltyCustomers } from "@/lib/data";

const INPUT_STYLE = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };

// Bouton loupe à poser à côté du champ « nom du client » (prise / modification
// de commande par l'équipe). Ouvre une recherche de compte fidélité par nom,
// prénom ou téléphone ; `onSelect(client)` reçoit le compte choisi. Aucun point
// n'est crédité ici : le compte est seulement rattaché à la commande, la Caisse
// le pré-sélectionne ensuite.
export function LoyaltyLookupButton({ initialTerm = "", onSelect, disabled = false }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-label="Rechercher un compte fidélité"
        title="Rechercher un compte fidélité"
        className="tap-scale shrink-0 rounded-xl px-4 text-xl border-2 border-[#3a2b1f] disabled:opacity-50"
        style={{ background: "#211712" }}
      >
        🔍
      </button>
      {open && (
        <LoyaltySearchModal
          initialTerm={initialTerm}
          onClose={() => setOpen(false)}
          onSelect={(c) => {
            setOpen(false);
            onSelect(c);
          }}
        />
      )}
    </>
  );
}

// Pastille « ⭐ Nom · téléphone ✕ » du compte rattaché à la commande.
export function LoyaltyLinkedChip({ customer, onClear }) {
  if (!customer) return null;
  return (
    <div
      className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold"
      style={{ background: "#204a3a", color: "#a8e8c8" }}
    >
      <span>
        ⭐ {customer.nom || "Sans nom"} · {customer.phone}
        {typeof customer.soldePoints === "number" ? ` · ${customer.soldePoints} pts` : ""}
      </span>
      <button type="button" onClick={onClear} aria-label="Retirer le compte fidélité" className="tap-scale font-bold px-1">
        ✕
      </button>
    </div>
  );
}

function LoyaltySearchModal({ initialTerm, onClose, onSelect }) {
  const [term, setTerm] = useState(initialTerm);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const reqId = useRef(0);

  // Recherche au fil de la frappe (léger délai), ou tout de suite via Entrée.
  async function run(raw) {
    const t = String(raw ?? term).trim();
    const id = ++reqId.current;
    if (t.length < 2) {
      setResults([]);
      setMsg(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const p = canonicalLoyaltyPhone(t);
      let list;
      if (p) {
        const c = await fetchLoyaltyCustomerByPhone(p);
        list = c ? [c] : [];
      } else {
        list = await searchLoyaltyCustomers(t);
      }
      if (id !== reqId.current) return; // une recherche plus récente a pris le relais
      setResults(list);
      if (list.length === 0) setMsg("Aucun compte trouvé.");
    } catch (err) {
      console.error(err);
      if (id === reqId.current) setMsg("Erreur pendant la recherche.");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }

  useEffect(() => {
    const h = setTimeout(() => run(term), 300);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="w-full md:max-w-lg md:rounded-3xl overflow-hidden flex flex-col"
        style={{ background: "#1a120b", color: "#f5ebdd", maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a2b1f]">
          <span className="display-font text-xl font-bold">⭐ Compte fidélité</span>
          <button type="button" onClick={onClose} aria-label="Fermer" className="tap-scale w-9 h-9 rounded-full bg-[#241811] text-[#c9b8a4] font-bold">
            ✕
          </button>
        </div>
        <div className="px-6 py-4 flex flex-col gap-3 overflow-y-auto">
          <input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run(term)}
            placeholder="Nom, prénom ou téléphone"
            className="w-full rounded-xl px-4 py-3 outline-none"
            style={INPUT_STYLE}
          />
          {loading && <div className="text-xs text-[#8a7561]">Recherche…</div>}
          {msg && !loading && <div className="text-sm text-[#E8B23D]">{msg}</div>}
          <div className="flex flex-col gap-2">
            {results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c)}
                className="tap-scale text-left rounded-xl border-2 border-[#3a2b1f] px-4 py-3 text-sm"
                style={{ background: "#211712" }}
              >
                <span className="font-bold">{c.nom || "Sans nom"}</span>
                <span className="text-[#a88f78]">
                  {" "}
                  · {c.phone} · {c.soldePoints} pts
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-[#8a7561]">
            Les points seront crédités en Caisse, une fois la commande réglée. Pour créer un nouveau compte, passe par la Caisse ou l'écran Fidélité.
          </p>
        </div>
      </div>
    </div>
  );
}
