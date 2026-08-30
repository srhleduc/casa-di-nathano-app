"use client";

// Espace équipe → Fidélité. Recherche d'un client par nom / prénom / téléphone,
// création manuelle, fiche client (solde de points, historique des mouvements,
// bons avec statut + réactivation). Base clients partagée entre les deux
// restaurants (voir lib/data.js et supabase/schema.sql).

import { useRef, useState } from "react";
import { canonicalLoyaltyPhone } from "@/lib/business";
import { eur } from "@/lib/menu";
import {
  fetchLoyaltyCustomerByPhone,
  searchLoyaltyCustomers,
  createLoyaltyCustomer,
  updateLoyaltyCustomer,
  useLoyaltyCustomer,
  useLoyaltyMovements,
  useLoyaltyPromoCodes,
  reactivatePromoCode,
  addManualPromoCode,
} from "@/lib/data";

const INPUT_STYLE = { background: "#140d08", border: "1px solid #3a2b1f", color: "#f5ebdd" };
const PRIMARY_BTN = { background: "#C0392B", color: "#fff5ea" };

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString("fr-FR");
}
function fmtDateTime(ts) {
  return new Date(ts).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtBirthday(dateStr) {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "long" });
}
function expiredSinceDays(expiresAt) {
  return Math.max(0, Math.floor((Date.now() - expiresAt) / 86400000));
}

const MOVEMENT_LABEL = { gain: "Gain", depense: "Dépense", ajustement: "Ajustement" };
const SOURCE_LABEL = { click_and_collect: "Click & collect", caisse: "Caisse" };
const REASON_LABEL = { palier_150: "Palier 150 points", anniversaire: "Anniversaire", manuel: "Ajout manuel" };

export default function LoyaltyAdmin({ readOnly = false }) {
  const [rawQuery, setRawQuery] = useState("");
  const [results, setResults] = useState(null); // null = pas encore cherché ; [] = aucun résultat
  const [createPhone, setCreatePhone] = useState(null); // string quand la recherche est un n° exact sans résultat
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const ficheRef = useRef(null);

  function scrollToFiche() {
    setTimeout(() => ficheRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  async function search(e) {
    e?.preventDefault();
    setError(null);
    setSelectedId(null);
    setCreatePhone(null);
    const term = rawQuery.trim();
    if (term.length < 2) {
      setError("Saisis au moins 2 caractères (nom, prénom ou numéro).");
      setResults(null);
      return;
    }
    setBusy(true);
    try {
      const phone = canonicalLoyaltyPhone(term);
      if (phone) {
        const c = await fetchLoyaltyCustomerByPhone(phone);
        if (c) {
          setResults([c]);
          setSelectedId(c.id);
          scrollToFiche();
        } else {
          setResults([]);
          setCreatePhone(phone);
        }
      } else {
        const list = await searchLoyaltyCustomers(term);
        setResults(list);
        if (list.length === 1) {
          setSelectedId(list[0].id);
          scrollToFiche();
        }
      }
    } catch (err) {
      console.error(err);
      setError("Erreur pendant la recherche.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(fields) {
    setBusy(true);
    setError(null);
    try {
      const customer = await createLoyaltyCustomer({ phone: createPhone, ...fields });
      setResults([customer]);
      setSelectedId(customer.id);
      setCreatePhone(null);
      scrollToFiche();
    } catch (err) {
      console.error(err);
      setError("Création impossible — ce numéro est peut-être déjà enregistré.");
    } finally {
      setBusy(false);
    }
  }

  const selected = selectedId ? results?.find((c) => c.id === selectedId) : null;
  const showList = results && results.length > 1 && !selectedId;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <form onSubmit={search} className="flex flex-wrap items-end gap-3 mb-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-[#a88f78] uppercase">Nom, prénom ou téléphone</span>
          <input
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Le Berre, Marie, ou 06 12 34 56 78"
            className="rounded-lg px-3 py-2 w-72"
            style={INPUT_STYLE}
          />
        </label>
        <button type="submit" disabled={busy} className="tap-scale rounded-lg px-5 py-2 font-bold text-sm disabled:opacity-50" style={PRIMARY_BTN}>
          🔎 Rechercher
        </button>
      </form>

      {error && (
        <p className="mb-4 text-sm font-bold" style={{ color: "#e88a8a" }}>
          {error}
        </p>
      )}

      {results && results.length === 0 && !createPhone && (
        <p className="text-[#a88f78] text-sm">Aucun client trouvé pour « {rawQuery.trim()} ».</p>
      )}

      {createPhone && (
        <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4 max-w-md">
          <div className="font-bold mb-1">Aucun client pour le {createPhone}</div>
          {readOnly ? (
            <p className="text-sm text-[#a88f78]">Création réservée à l&apos;équipe sur place.</p>
          ) : (
            <CreateForm phone={createPhone} busy={busy} onCreate={handleCreate} />
          )}
        </div>
      )}

      {showList && (
        <div className="flex flex-col gap-2 max-w-2xl">
          <div className="text-xs text-[#a88f78] uppercase font-bold">{results.length} résultats</div>
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setSelectedId(c.id);
                scrollToFiche();
              }}
              className="tap-scale text-left rounded-lg border border-[#3a2b1f] bg-[#211712] px-4 py-3 flex items-center justify-between gap-3"
            >
              <span>
                <span className="font-bold">{c.nom || "Client sans nom"}</span>
                <span className="text-[#a88f78] text-sm"> · {c.phone}</span>
                {c.dateAnniversaire && <span className="text-[#8a7561] text-sm"> · 🎂 {fmtBirthday(c.dateAnniversaire)}</span>}
              </span>
              <span className="shrink-0 font-bold text-[#E8B23D]">{c.soldePoints} pts</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div ref={ficheRef}>
          <CustomerFile
            customerId={selected.id}
            readOnly={readOnly}
            onBack={results && results.length > 1 ? () => setSelectedId(null) : undefined}
          />
        </div>
      )}
    </div>
  );
}

function CreateForm({ phone, busy, onCreate }) {
  const [nom, setNom] = useState("");
  const [dateAnniversaire, setDateAnniversaire] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onCreate({ nom: nom.trim(), dateAnniversaire });
      }}
      className="mt-3 flex flex-col gap-3"
    >
      <div className="text-xs text-[#8a7561]">Numéro : {phone}</div>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-bold text-[#a88f78] uppercase">Nom (facultatif)</span>
        <input value={nom} onChange={(e) => setNom(e.target.value)} className="rounded-lg px-3 py-2" style={INPUT_STYLE} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-bold text-[#a88f78] uppercase">Date d&apos;anniversaire (facultatif)</span>
        <input type="date" value={dateAnniversaire} onChange={(e) => setDateAnniversaire(e.target.value)} className="rounded-lg px-3 py-2" style={INPUT_STYLE} />
      </label>
      <button type="submit" disabled={busy} className="tap-scale rounded-lg px-4 py-2 font-bold text-sm self-start disabled:opacity-50" style={PRIMARY_BTN}>
        ➕ Créer le client
      </button>
    </form>
  );
}

function CustomerFile({ customerId, readOnly, onBack }) {
  const { customer } = useLoyaltyCustomer(customerId);
  const { movements } = useLoyaltyMovements(customerId);
  const { promoCodes } = useLoyaltyPromoCodes(customerId);
  const [editing, setEditing] = useState(false);
  const [addingBon, setAddingBon] = useState(false);

  async function addBon() {
    if (!window.confirm("Créer un bon de 5 € pour ce client ? (valable 21 jours)")) return;
    setAddingBon(true);
    try {
      await addManualPromoCode(customerId, 5);
    } catch (err) {
      console.error(err);
    } finally {
      setAddingBon(false);
    }
  }

  if (!customer) return <p className="text-[#8a7561]">Chargement de la fiche…</p>;

  return (
    <div className="flex flex-col gap-4">
      {onBack && (
        <button onClick={onBack} className="self-start text-[#c9b8a4] text-sm font-semibold tap-scale">
          ← Retour à la liste
        </button>
      )}

      <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="display-font text-2xl font-bold">{customer.nom || "Client sans nom"}</div>
            <div className="text-[#a88f78] text-sm">{customer.phone}</div>
            {customer.dateAnniversaire && <div className="text-[#a88f78] text-sm">🎂 {fmtBirthday(customer.dateAnniversaire)}</div>}
          </div>
          <div className="text-right">
            <div className="text-xs text-[#a88f78] uppercase font-bold">Solde</div>
            <div className="display-font text-3xl font-bold text-[#E8B23D]">{customer.soldePoints} pts</div>
          </div>
        </div>
        {!readOnly && (
          <button onClick={() => setEditing((v) => !v)} className="tap-scale mt-3 rounded-full px-4 py-1.5 text-xs font-bold border-2 border-[#3a2b1f]">
            {editing ? "Fermer" : "✏️ Modifier nom / anniversaire"}
          </button>
        )}
        {editing && !readOnly && <EditForm customer={customer} onDone={() => setEditing(false)} />}
      </div>

      <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="font-bold">Bons ({promoCodes.length})</div>
          {!readOnly && (
            <button
              onClick={addBon}
              disabled={addingBon}
              className="tap-scale shrink-0 rounded-full px-4 py-1.5 text-xs font-bold disabled:opacity-50"
              style={PRIMARY_BTN}
            >
              ➕ Ajouter un bon de 5 €
            </button>
          )}
        </div>
        {promoCodes.length === 0 && <p className="text-[#8a7561] text-sm">Aucun bon.</p>}
        <div className="flex flex-col gap-2">
          {promoCodes.map((b) => (
            <PromoCodeRow key={b.id} bon={b} readOnly={readOnly} />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
        <div className="font-bold mb-3">Historique des points ({movements.length})</div>
        {movements.length === 0 && <p className="text-[#8a7561] text-sm">Aucun mouvement.</p>}
        <div className="flex flex-col gap-1">
          {movements.map((m) => {
            const positive = m.points >= 0;
            return (
              <div key={m.id} className="flex items-center justify-between text-sm py-1 border-b border-[#2a1f16] last:border-0">
                <span className="text-[#c9b8a4]">
                  {fmtDateTime(m.createdAt)} · {MOVEMENT_LABEL[m.type] || m.type}
                  {m.source ? ` · ${SOURCE_LABEL[m.source] || m.source}` : ""}
                </span>
                <span className="font-bold" style={{ color: positive ? "#7fb069" : "#e88a8a" }}>
                  {positive ? "+" : ""}
                  {m.points} pts
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PromoCodeRow({ bon, readOnly }) {
  const [busy, setBusy] = useState(false);

  async function reactivate() {
    setBusy(true);
    try {
      await reactivatePromoCode(bon.id);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  const badge =
    bon.status === "actif"
      ? { text: `Actif — expire le ${fmtDate(bon.expiresAt)}`, bg: "#204a3a", fg: "#a8e8c8" }
      : bon.status === "utilise"
      ? { text: "Utilisé", bg: "#2c2c2c", fg: "#9a9a9a" }
      : { text: `Expiré depuis ${expiredSinceDays(bon.expiresAt)} jour${expiredSinceDays(bon.expiresAt) > 1 ? "s" : ""}`, bg: "#4a1f1f", fg: "#e8a8a8" };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#3a2b1f] px-3 py-2">
      <div>
        <div className="font-bold text-sm">
          {eur(bon.reduction)} · <span className="text-[#a88f78]">{REASON_LABEL[bon.reason] || bon.reason}</span>
        </div>
        <div className="text-xs text-[#8a7561]">Code {bon.code} · créé le {fmtDate(bon.createdAt)}</div>
        <span className="inline-block mt-1 text-xs font-bold rounded-full px-2 py-0.5" style={{ background: badge.bg, color: badge.fg }}>
          {badge.text}
        </span>
      </div>
      {!readOnly && bon.status === "expire" && (
        <button onClick={reactivate} disabled={busy} className="tap-scale shrink-0 rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50" style={PRIMARY_BTN}>
          ♻️ Réactiver
        </button>
      )}
    </div>
  );
}

function EditForm({ customer, onDone }) {
  const [nom, setNom] = useState(customer.nom || "");
  const [dateAnniversaire, setDateAnniversaire] = useState(customer.dateAnniversaire || "");
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateLoyaltyCustomer(customer.id, { nom: nom.trim(), dateAnniversaire });
      onDone();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-3 flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-bold text-[#a88f78] uppercase">Nom</span>
        <input value={nom} onChange={(e) => setNom(e.target.value)} className="rounded-lg px-3 py-2" style={INPUT_STYLE} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-bold text-[#a88f78] uppercase">Anniversaire</span>
        <input type="date" value={dateAnniversaire} onChange={(e) => setDateAnniversaire(e.target.value)} className="rounded-lg px-3 py-2" style={INPUT_STYLE} />
      </label>
      <button type="submit" disabled={busy} className="tap-scale rounded-lg px-4 py-2 font-bold text-sm disabled:opacity-50" style={PRIMARY_BTN}>
        Enregistrer
      </button>
    </form>
  );
}
