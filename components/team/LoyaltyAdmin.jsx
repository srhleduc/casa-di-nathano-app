"use client";

// Espace équipe → Fidélité. Recherche d'un client par nom / prénom / téléphone,
// création manuelle, fiche client (solde de points, historique des mouvements,
// bons avec statut — actifs et inactifs — cliquables pour prolonger /
// réactiver à une date au choix ou supprimer). Base clients partagée entre les
// deux restaurants (voir lib/data.js et supabase/schema.sql).

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
  setPromoCodeExpiry,
  deletePromoCode,
  addManualPromoCode,
  awardLoyaltyPointsManual,
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
// "YYYY-MM-DD" du jour + offset (pour les <input type="date">).
function isoDay(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); // fige sur la date locale
  return d.toISOString().slice(0, 10);
}

const MOVEMENT_LABEL = { gain: "Gain", depense: "Bon débloqué", ajustement: "Ajustement" };
const SOURCE_LABEL = { click_and_collect: "Click & collect", caisse: "Caisse" };
const REASON_LABEL = { palier_150: "Palier 150 points", anniversaire: "Anniversaire", manuel: "Ajout manuel" };

export default function LoyaltyAdmin({ readOnly = false }) {
  const [rawQuery, setRawQuery] = useState("");
  const [results, setResults] = useState(null); // null = pas encore cherché ; [] = aucun résultat
  const [createPhone, setCreatePhone] = useState(null); // string quand la recherche est un n° exact sans résultat
  const [creatingNew, setCreatingNew] = useState(false); // formulaire "Créer un compte" ouvert
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
    setCreatingNew(false);
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

  // `fields.phone` est fourni (brut) par le formulaire "Créer un compte" ;
  // sinon on retombe sur `createPhone` (recherche d'un n° exact sans résultat).
  async function handleCreate({ phone: rawPhone, nom, dateAnniversaire }) {
    const phone = rawPhone !== undefined ? canonicalLoyaltyPhone(rawPhone) : createPhone;
    if (!phone) {
      setError("Numéro invalide — format attendu : 0X XX XX XX XX.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const customer = await createLoyaltyCustomer({ phone, nom, dateAnniversaire });
      setResults([customer]);
      setSelectedId(customer.id);
      setCreatePhone(null);
      setCreatingNew(false);
      scrollToFiche();
    } catch (err) {
      console.error(err);
      // 23505 = numéro déjà pris : on ouvre la fiche existante plutôt qu'une erreur sèche.
      if (err?.code === "23505") {
        const existing = await fetchLoyaltyCustomerByPhone(phone).catch(() => null);
        if (existing) {
          setResults([existing]);
          setSelectedId(existing.id);
          setCreatePhone(null);
          setCreatingNew(false);
          setError("Ce numéro a déjà un compte — fiche ouverte.");
          scrollToFiche();
          return;
        }
      }
      setError("Création impossible.");
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
        {!readOnly && (
          <button
            type="button"
            onClick={() => {
              setCreatingNew(true);
              setError(null);
              setResults(null);
              setSelectedId(null);
              setCreatePhone(null);
            }}
            className="tap-scale rounded-lg px-5 py-2 font-bold text-sm border-2 border-[#3a2b1f]"
          >
            ➕ Créer un compte
          </button>
        )}
      </form>

      {error && (
        <p className="mb-4 text-sm font-bold" style={{ color: "#e88a8a" }}>
          {error}
        </p>
      )}

      {creatingNew && !readOnly && (
        <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4 max-w-md mb-4">
          <div className="font-bold mb-1">Nouveau compte fidélité</div>
          <CreateForm phoneEditable busy={busy} onCreate={handleCreate} onCancel={() => setCreatingNew(false)} />
        </div>
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

function CreateForm({ phone, phoneEditable = false, busy, onCreate, onCancel }) {
  const [phoneInput, setPhoneInput] = useState(phone || "");
  const [nom, setNom] = useState("");
  const [dateAnniversaire, setDateAnniversaire] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onCreate({ phone: phoneEditable ? phoneInput : undefined, nom: nom.trim(), dateAnniversaire });
      }}
      className="mt-3 flex flex-col gap-3"
    >
      {phoneEditable ? (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-[#a88f78] uppercase">Téléphone</span>
          <input
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            type="tel"
            inputMode="tel"
            required
            placeholder="06 12 34 56 78"
            className="rounded-lg px-3 py-2"
            style={INPUT_STYLE}
          />
        </label>
      ) : (
        <div className="text-xs text-[#8a7561]">Numéro : {phone}</div>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-bold text-[#a88f78] uppercase">Nom (facultatif)</span>
        <input value={nom} onChange={(e) => setNom(e.target.value)} className="rounded-lg px-3 py-2" style={INPUT_STYLE} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-bold text-[#a88f78] uppercase">Date d&apos;anniversaire (facultatif)</span>
        <input type="date" value={dateAnniversaire} onChange={(e) => setDateAnniversaire(e.target.value)} className="rounded-lg px-3 py-2" style={INPUT_STYLE} />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="tap-scale rounded-lg px-4 py-2 font-bold text-sm disabled:opacity-50" style={PRIMARY_BTN}>
          ➕ Créer le client
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="tap-scale rounded-lg px-4 py-2 font-bold text-sm border-2 border-[#3a2b1f]">
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}

function CustomerFile({ customerId, readOnly, onBack }) {
  const { customer } = useLoyaltyCustomer(customerId);
  const { movements } = useLoyaltyMovements(customerId);
  const { promoCodes } = useLoyaltyPromoCodes(customerId);
  const [editing, setEditing] = useState(false);
  const [addingBon, setAddingBon] = useState(false);
  const [addingPoints, setAddingPoints] = useState(false);

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
        {!readOnly && <WalletButton customer={customer} />}
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
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="font-bold">Historique des points ({movements.length})</div>
          {!readOnly && (
            <button
              onClick={() => setAddingPoints((v) => !v)}
              className="tap-scale shrink-0 rounded-full px-4 py-1.5 text-xs font-bold disabled:opacity-50"
              style={PRIMARY_BTN}
            >
              {addingPoints ? "Fermer" : "➕ Ajouter des points"}
            </button>
          )}
        </div>
        {addingPoints && !readOnly && (
          <ManualPointsForm customer={customer} onDone={() => setAddingPoints(false)} />
        )}
        {movements.length === 0 && <p className="text-[#8a7561] text-sm">Aucun mouvement.</p>}
        <div className="flex flex-col gap-1">
          {movements.map((m) => {
            const positive = m.points >= 0;
            return (
              <div key={m.id} className="text-sm py-1 border-b border-[#2a1f16] last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-[#c9b8a4]">
                    {fmtDateTime(m.createdAt)} · {MOVEMENT_LABEL[m.type] || m.type}
                    {m.source ? ` · ${SOURCE_LABEL[m.source] || m.source}` : ""}
                  </span>
                  <span className="font-bold" style={{ color: positive ? "#7fb069" : "#e88a8a" }}>
                    {positive ? "+" : ""}
                    {m.points} pts
                  </span>
                </div>
                {m.note && <div className="text-[#8a7561] text-xs mt-0.5">{m.note}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Ajout de points manuel (fiche client équipe) : crédite des points a posteriori
// quand un client a oublié de donner son numéro à la commande, sans repasser par
// une fausse commande. Passe par awardLoyaltyPointsManual -> award_loyalty_points
// (fonction Postgres inchangée) + motif optionnel dans loyalty_movements.note.
// Après succès : patchLoyaltyPoints via /api/wallet/update-points, fire-and-forget
// et non bloquant, exactement comme CaisseBoard après un gain en caisse.
function ManualPointsForm({ customer, onDone }) {
  const [points, setPoints] = useState("");
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    const n = Math.floor(Number(points));
    if (!Number.isFinite(n) || n <= 0) {
      setErr("Saisis un nombre de points entier supérieur à 0.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const newSolde = await awardLoyaltyPointsManual(customer.id, customer.phone, n, motif);
      if (newSolde == null) {
        setErr("Numéro du client invalide — aucun point crédité.");
        return;
      }
      // Resync de la carte Google Wallet + notification (nouveau solde, ou
      // déblocage de bon si un palier est franchi). Fire-and-forget, ne doit
      // jamais gêner l'ajout de points (cf. CaisseBoard).
      fetch("/api/wallet/update-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customer.id, solde: newSolde, pointsAdded: n }),
      }).catch(() => {});
      onDone();
    } catch (e2) {
      console.error(e2);
      setErr("Ajout impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-3 flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-bold text-[#a88f78] uppercase">Points à créditer</span>
        <input
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          className="w-32 rounded-lg px-3 py-2"
          style={INPUT_STYLE}
          autoFocus
        />
      </label>
      <label className="flex flex-1 flex-col gap-1 min-w-[12rem]">
        <span className="text-xs font-bold text-[#a88f78] uppercase">Motif (optionnel)</span>
        <input
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="ex : oubli fidélité, commande du 3/09"
          className="rounded-lg px-3 py-2"
          style={INPUT_STYLE}
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="tap-scale rounded-lg px-4 py-2 font-bold text-sm disabled:opacity-50"
        style={PRIMARY_BTN}
      >
        {busy ? "Ajout…" : "Créditer"}
      </button>
      {err && (
        <div className="w-full text-xs" style={{ color: "#e88a8a" }}>
          {err}
        </div>
      )}
    </form>
  );
}

// Bouton de génération du lien "Ajouter à Google Wallet" pour ce client.
// Staff-facing : on ouvre le lien dans un onglet ET on l'affiche en clair pour
// que la serveuse le passe / le fasse scanner sur le téléphone du client.
// /api/wallet/create-pass marque wallet_added_at de façon optimiste : le bouton
// se transforme en confirmation dès le rafraîchissement temps réel de la fiche.
function WalletButton({ customer }) {
  const [busy, setBusy] = useState(false);
  const [saveUrl, setSaveUrl] = useState(null);
  const [err, setErr] = useState(null);

  async function generate() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/wallet/create-pass?customer_id=${encodeURIComponent(customer.id)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de génération");
      setSaveUrl(data.saveUrl);
      window.open(data.saveUrl, "_blank", "noopener");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      {customer.walletAddedAt && !saveUrl ? (
        <div className="text-xs font-semibold" style={{ color: "#7fb069" }}>
          📲 Carte Google Wallet ajoutée le {fmtDateTime(customer.walletAddedAt)}
        </div>
      ) : (
        <button
          onClick={generate}
          disabled={busy}
          className="tap-scale rounded-full px-4 py-1.5 text-xs font-bold border-2 border-[#3a2b1f] disabled:opacity-50"
        >
          {busy ? "Génération…" : "📲 Ajouter à Google Wallet"}
        </button>
      )}
      {saveUrl && (
        <div className="mt-2">
          <div className="text-xs text-[#a88f78] mb-1">
            Lien à ouvrir / faire scanner sur le téléphone du client :
          </div>
          <input
            readOnly
            value={saveUrl}
            onFocus={(e) => e.target.select()}
            className="w-full rounded px-2 py-1 text-xs"
            style={INPUT_STYLE}
          />
        </div>
      )}
      {err && (
        <div className="text-xs mt-1" style={{ color: "#e88a8a" }}>
          {err}
        </div>
      )}
    </div>
  );
}

// Ligne de bon. Cliquable (hors espace Direction) quand le bon est 'actif' ou
// 'expire' : ouvre un panneau pour prolonger / réactiver (date au choix) ou
// supprimer. Les bons 'utilise' restent en lecture seule.
function PromoCodeRow({ bon, readOnly }) {
  const isActive = bon.status === "actif";
  const isExpired = bon.status === "expire";
  const clickable = !readOnly && (isActive || isExpired);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [date, setDate] = useState(isoDay(21));

  async function applyExpiry() {
    if (!date) return;
    setBusy(true);
    setErr(null);
    try {
      await setPromoCodeExpiry(bon.id, new Date(`${date}T23:59:59`).toISOString());
      setOpen(false);
    } catch (e) {
      console.error(e);
      setErr("Échec de la mise à jour.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const msg =
      bon.reason === "palier_150"
        ? "Supprimer ce bon ? Les 150 points consommés pour l'obtenir ne sont pas re-crédités — à rajouter à la main si besoin."
        : "Supprimer définitivement ce bon ?";
    if (!window.confirm(msg)) return;
    setBusy(true);
    setErr(null);
    try {
      await deletePromoCode(bon.id);
    } catch (e) {
      console.error(e);
      setErr("Échec de la suppression.");
      setBusy(false);
    }
  }

  const badge = isActive
    ? { text: `Actif · jusqu'au ${fmtDate(bon.expiresAt)}`, bg: "#204a3a", fg: "#a8e8c8" }
    : bon.status === "utilise"
    ? { text: "Utilisé", bg: "#2c2c2c", fg: "#9a9a9a" }
    : { text: `Inactif · depuis le ${fmtDate(bon.expiresAt)}`, bg: "#4a1f1f", fg: "#e8a8a8" };

  return (
    <div className="rounded-lg border border-[#3a2b1f] px-3 py-2">
      <div
        className={clickable ? "cursor-pointer" : undefined}
        onClick={clickable ? () => setOpen((v) => !v) : undefined}
      >
        <div className="font-bold text-sm">
          {eur(bon.reduction)} · <span className="text-[#a88f78]">{REASON_LABEL[bon.reason] || bon.reason}</span>
          {clickable && <span className="text-[#5a4a3a] ml-2">{open ? "▲" : "▼"}</span>}
        </div>
        <div className="text-xs text-[#8a7561]">Code {bon.code} · créé le {fmtDate(bon.createdAt)}</div>
        <span className="inline-block mt-1 text-xs font-bold rounded-full px-2 py-0.5" style={{ background: badge.bg, color: badge.fg }}>
          {badge.text}
        </span>
      </div>

      {open && clickable && (
        <div className="mt-3 border-t border-[#2a1f16] pt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-[#a88f78]">
              {isExpired ? "Réactiver jusqu'au" : "Prolonger jusqu'au"}
            </span>
            <input
              type="date"
              min={isoDay(0)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded px-2 py-1 text-sm"
              style={INPUT_STYLE}
            />
          </label>
          <button
            onClick={applyExpiry}
            disabled={busy || !date}
            className="tap-scale shrink-0 rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50"
            style={PRIMARY_BTN}
          >
            {isExpired ? "♻️ Réactiver" : "📅 Prolonger"}
          </button>
          <button
            onClick={remove}
            disabled={busy}
            className="tap-scale shrink-0 rounded-full px-4 py-2 text-xs font-bold border-2 border-[#7a2a2a] text-[#e8a8a8] disabled:opacity-50"
          >
            🗑️ Supprimer
          </button>
          {err && <div className="w-full text-xs" style={{ color: "#e88a8a" }}>{err}</div>}
        </div>
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
