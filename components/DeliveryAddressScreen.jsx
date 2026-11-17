"use client";

// Étape « adresse de livraison » du parcours /commande (mode « Me faire
// livrer »). Le client tape son adresse, choisit une suggestion (service
// d'adresses officiel, voir app/api/adresse/route.js), puis on lui dit tout de
// suite si on livre chez lui, combien ça coûte et quel est le minimum de
// commande — avant qu'il compose son panier. Le prix définitif est de toute
// façon recalculé par la base au moment de la commande.

import { useEffect, useRef, useState } from "react";
import { eur } from "@/lib/menu";
import { quoteDelivery } from "@/lib/data";

export default function DeliveryAddressScreen({ restaurantName, initial, onBack, onConfirm }) {
  const [query, setQuery] = useState(initial?.address?.label || "");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [selected, setSelected] = useState(initial?.address || null);
  const [instructions, setInstructions] = useState(initial?.instructions || "");
  const [quote, setQuote] = useState(initial?.quote || null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState(null);
  const searchSeq = useRef(0);

  // Recherche avec une petite temporisation (on n'interroge pas le service à
  // chaque lettre). `searchSeq` écarte les réponses arrivées en retard.
  useEffect(() => {
    if (selected && query === selected.label) return;
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSearchError(null);
      return;
    }
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/adresse?q=${encodeURIComponent(q)}`);
        const json = await res.json().catch(() => ({}));
        if (seq !== searchSeq.current) return;
        setResults(json.results || []);
        setSearchError(res.ok ? null : "Recherche d'adresse indisponible, réessayez dans un instant.");
      } catch {
        if (seq === searchSeq.current) setSearchError("Recherche d'adresse indisponible, réessayez dans un instant.");
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, selected]);

  async function pick(r) {
    setSelected(r);
    setQuery(r.label);
    setResults([]);
    setQuote(null);
    setQuoteError(null);
    setQuoting(true);
    try {
      setQuote(await quoteDelivery({ lat: r.lat, lng: r.lng, postalCode: r.postcode, subtotal: 0 }));
    } catch (err) {
      console.error("Devis de livraison impossible", err);
      setQuoteError("Impossible de vérifier cette adresse pour le moment. Réessayez, ou appelez le restaurant.");
    } finally {
      setQuoting(false);
    }
  }

  const canContinue = Boolean(selected && quote?.deliverable);

  return (
    <div className="flex-1 flex flex-col px-6 py-6 overflow-y-auto">
      <button onClick={onBack} className="text-[#c9b8a4] text-sm font-semibold mb-6 self-start tap-scale">
        ← Retour
      </button>
      <h2 className="display-font text-3xl font-semibold mb-2">Où livrer ?</h2>
      <p className="text-[#a88f78] mb-6">
        {restaurantName} vous livre à domicile. Saisissez votre adresse pour vérifier que vous êtes dans la zone.
      </p>

      <div className="text-sm font-bold text-[#a88f78] uppercase tracking-wide mb-2">Adresse de livraison</div>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (selected && e.target.value !== selected.label) {
            setSelected(null);
            setQuote(null);
          }
        }}
        autoComplete="street-address"
        placeholder="Ex. 12 rue des Lilas, Riec-sur-Belon"
        className="w-full rounded-xl px-4 py-4 text-lg outline-none"
        style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
      />

      {searching && <p className="text-sm text-[#8a7561] mt-2">Recherche…</p>}
      {searchError && (
        <p className="text-sm mt-2" style={{ color: "#e88a8a" }}>
          {searchError}
        </p>
      )}
      {results.length > 0 && (
        <div className="rounded-xl mt-2 overflow-hidden" style={{ background: "#211712", border: "1px solid #3a2b1f" }}>
          {results.map((r) => (
            <button
              key={`${r.label}-${r.lat}-${r.lng}`}
              onClick={() => pick(r)}
              className="tap-scale w-full text-left px-4 py-3 text-base border-b last:border-b-0"
              style={{ borderColor: "#3a2b1f", color: "#f5ebdd" }}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
      {!searching && !selected && query.trim().length >= 3 && results.length === 0 && !searchError && (
        <p className="text-sm text-[#8a7561] mt-2">Aucune adresse trouvée — essayez avec le numéro et le nom de la rue.</p>
      )}

      {quoting && <p className="text-sm text-[#8a7561] mt-4">Vérification de la zone…</p>}
      {quoteError && (
        <p className="text-sm mt-4" style={{ color: "#e88a8a" }}>
          {quoteError}
        </p>
      )}
      {quote && !quote.deliverable && (
        <div className="rounded-xl px-4 py-4 mt-4" style={{ background: "#2c1c14", border: "1px solid #C0392B" }}>
          <div className="font-bold mb-1">😕 Livraison impossible à cette adresse</div>
          <p className="text-sm text-[#c9b8a4]">{quote.reason || "Cette adresse est hors de notre zone de livraison."} Vous pouvez venir récupérer votre commande sur place.</p>
        </div>
      )}
      {quote?.deliverable && (
        <div className="rounded-xl px-4 py-4 mt-4" style={{ background: "#1f2a1a", border: "1px solid #4a7a3a" }}>
          <div className="font-bold mb-2">✅ On vous livre !</div>
          <div className="text-sm text-[#c9b8a4] leading-relaxed">
            Frais de livraison : <span className="font-bold text-[#f5ebdd]">{quote.fee > 0 ? eur(quote.fee) : "offerts"}</span>
            {quote.minOrder > 0 && (
              <>
                <br />
                Minimum de commande : <span className="font-bold text-[#f5ebdd]">{eur(quote.minOrder)}</span>
              </>
            )}
            {quote.estimatedMinutes ? (
              <>
                <br />
                Délai de livraison estimé : <span className="font-bold text-[#f5ebdd]">environ {quote.estimatedMinutes} min</span> après la préparation
              </>
            ) : null}
          </div>
        </div>
      )}

      {canContinue && (
        <div className="mt-6">
          <div className="text-sm font-bold text-[#a88f78] uppercase tracking-wide mb-2">Précisions pour le livreur (facultatif)</div>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Ex. Bâtiment B, 2e étage, code 1234, portail vert…"
            className="w-full rounded-xl px-4 py-3 text-base outline-none resize-none"
            style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
          />
        </div>
      )}

      <button
        onClick={() => onConfirm({ address: selected, instructions: instructions.trim(), quote })}
        disabled={!canContinue}
        className="tap-scale rounded-full py-6 text-2xl font-bold disabled:opacity-40 mt-8"
        style={{ background: "#C0392B", color: "#fff5ea" }}
      >
        Choisir mes plats →
      </button>
      <p className="text-center text-[#8a7561] text-sm mt-4">Paiement au livreur, à la livraison.</p>
    </div>
  );
}
