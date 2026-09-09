"use client";

// Page publique /reserver : le client saisit nom + téléphone + nombre de
// personnes + date, on ne lui propose que des créneaux RÉELLEMENT compatibles
// avec la salle, les réservations déjà en place et les services actifs ce
// jour-là (moteur d'optimisation, /api/reservations/solve). La complexité du
// plan de salle n'est jamais exposée. Aucun accès équipe (comme /sat).
//
// Le client peut aussi retrouver une réservation à venir (téléphone + nom,
// correspondance souple) pour changer l'heure / le nombre de personnes (même
// jour) ou l'annuler.

import { useMemo, useState } from "react";
import {
  useRestaurant,
} from "@/lib/restaurant";
import {
  useReservationSettings,
  useServiceTemplates,
  useServiceOverrides,
  useServiceExceptions,
  useTables,
  useTableCombinations,
  useReservations,
  createReservation,
  updateReservation,
} from "@/lib/data";
import { servicesForDate } from "@/lib/reservation/services";
import { buildCandidateSlots, buildRequestedAtISO, reservationsForSolver } from "@/lib/reservation/slots";
import { solveReservations } from "@/lib/reservation/api";
import { findUpcomingReservations } from "@/lib/reservation/booking-identity";
import { sortByFillPriority, sortByComboPriority } from "@/lib/business";
import ResaNote from "@/components/ResaNote";

const REMINDER =
  "Petit rappel : afin de garantir un service fluide et de pouvoir accueillir l'ensemble de nos clients dans les meilleures conditions, nous prévoyons environ 1h30 dans la mesure du possible par table. Merci de votre compréhension 😊";

const todayISO = () => new Date().toISOString().slice(0, 10);
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}h${String(min % 60).padStart(2, "0")}`;
const prettyDate = (iso) => {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  } catch {
    return iso;
  }
};
// "YYYY-MM-DDTHH:MM:00" heure murale locale — même repère que requested_at.
const nowWall = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
};

function PartyStepper({ value, onChange }) {
  return (
    <div className="flex items-center gap-4 mt-1">
      <button onClick={() => onChange(Math.max(1, value - 1))} className="tap-scale w-11 h-11 rounded-full text-2xl font-bold" style={{ background: "#1c1410", border: "1px solid #3a2a1f" }}>
        −
      </button>
      <span className="text-2xl font-bold w-10 text-center">{value}</span>
      <button onClick={() => onChange(Math.min(20, value + 1))} className="tap-scale w-11 h-11 rounded-full text-2xl font-bold" style={{ background: "#1c1410", border: "1px solid #3a2a1f" }}>
        +
      </button>
    </div>
  );
}

export default function ReservationBooking() {
  const restaurant = useRestaurant();
  const { settings } = useReservationSettings();
  const { serviceTemplates } = useServiceTemplates();
  const { serviceOverrides } = useServiceOverrides();
  const { serviceExceptions } = useServiceExceptions();
  const { tables } = useTables();
  const { combinations } = useTableCombinations();
  const { reservations } = useReservations();

  // form | slots | done | manage-find | manage-list | manage-edit | manage-slots | manage-done
  const [screen, setScreen] = useState("form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [party, setParty] = useState(2);
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [slots, setSlots] = useState([]); // [{ startMin, durationMin, serviceLabel }]
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(null); // { name, party, date, startMin }

  // --- gestion d'une réservation existante ---
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupName, setLookupName] = useState("");
  const [matches, setMatches] = useState([]);
  const [lookupHint, setLookupHint] = useState(null);
  const [editing, setEditing] = useState(null); // réservation en cours de modif
  const [editParty, setEditParty] = useState(2);
  const [editNote, setEditNote] = useState("");
  const [manageOutcome, setManageOutcome] = useState(null); // "modified" | "cancelled"
  const [confirmCancelId, setConfirmCancelId] = useState(null);

  // Créneaux proposés regroupés par service (nom du service + ses horaires),
  // groupes ordonnés par l'heure du premier créneau.
  const slotGroups = useMemo(() => {
    const by = new Map();
    for (const s of slots) {
      const key = s.serviceNumber ?? s.serviceLabel ?? "?";
      if (!by.has(key)) by.set(key, { label: s.serviceLabel || "Service", minStart: s.startMin, items: [] });
      const g = by.get(key);
      g.items.push(s);
      g.minStart = Math.min(g.minStart, s.startMin);
    }
    const groups = [...by.values()];
    for (const g of groups) g.items.sort((a, b) => a.startMin - b.startMin);
    return groups.sort((a, b) => a.minStart - b.minStart);
  }, [slots]);

  const dark = { background: "#150e0a", color: "#f5ebdd" };
  const inputStyle = { background: "#1c1410", border: "1px solid #3a2a1f", color: "#f5ebdd" };

  if (!settings.onlineBookingEnabled) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={dark}>
        <span className="text-5xl mb-3">🕒</span>
        <h1 className="display-font text-3xl font-semibold mb-2">{restaurant.name}</h1>
        <p className="text-[#b9a692] max-w-sm">
          La réservation en ligne n'est pas disponible pour le moment. Merci de nous appeler directement.
        </p>
      </div>
    );
  }

  // Créneaux réellement possibles pour (date, party). `excludeReservationId` :
  // ignore une réservation existante (elle ne doit pas bloquer son propre
  // créneau quand le client la modifie).
  async function runFeasibility(targetDate, targetParty, { excludeReservationId } = {}) {
    const svcs = servicesForDate(targetDate, serviceTemplates, serviceOverrides, serviceExceptions);
    if (svcs.length === 0) return [];
    const isToday = targetDate === todayISO();
    const now = new Date();
    const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() : null;
    const candidateSlots = buildCandidateSlots(svcs, settings, targetParty, { nowMin });
    const existing = excludeReservationId ? reservations.filter((r) => r.id !== excludeReservationId) : reservations;
    const input = {
      tables: sortByFillPriority(tables.filter((t) => t.active && (t.bookableOnline ?? true) && !t.blocked)).map((t) => ({
        id: t.id,
        capacityMin: t.capacityMin,
        capacityPreferred: t.capacityPreferred,
        capacityMax: t.capacityMax,
        capacityBase: t.capacityBase,
        priorityOrder: t.priorityOrder,
        active: true,
      })),
      combinations: sortByComboPriority(combinations).map((c) => ({ id: c.id, tableIds: c.tableIds, capacity: c.capacity, isUsual: c.isUsual, penaltyScore: c.penaltyScore })),
      reservations: reservationsForSolver(existing, targetDate),
      safetyMarginMinutes: settings.safetyMarginMinutes || 0,
      candidateSlots,
    };
    const res = await solveReservations(input);
    return (res.feasibleSlots || []).slice().sort((a, b) => a.startMin - b.startMin);
  }

  async function search() {
    setErr(null);
    if (!name.trim() || !phone.trim()) {
      setErr("Merci d'indiquer votre nom et votre numéro de téléphone.");
      return;
    }
    setBusy(true);
    try {
      setSlots(await runFeasibility(date, party));
      setScreen("slots");
    } catch (e) {
      console.error(e);
      setErr("Impossible de récupérer les créneaux. Réessayez dans un instant.");
    } finally {
      setBusy(false);
    }
  }

  async function book(slot) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await createReservation({
        customerName: name.trim(),
        customerPhone: phone.trim(),
        partySize: party,
        requestedAt: buildRequestedAtISO(date, slot.startMin),
        estimatedDurationMinutes: slot.durationMin,
        source: "client",
        note: note.trim() || null,
      });
      setConfirmed({ name: name.trim(), party, date, startMin: slot.startMin });
      setScreen("done");
    } catch (e) {
      console.error(e);
      setErr("La réservation n'a pas pu être enregistrée. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  function findReservation() {
    setErr(null);
    if (!lookupPhone.trim() || !lookupName.trim()) {
      setErr("Indiquez votre téléphone et le nom de la réservation.");
      return;
    }
    const { matches: found, phoneOnly } = findUpcomingReservations(reservations, {
      phone: lookupPhone,
      name: lookupName,
      nowWall: nowWall(),
    });
    if (found.length > 0) {
      setMatches(found);
      setLookupHint(null);
      setConfirmCancelId(null);
      setScreen("manage-list");
      return;
    }
    setMatches([]);
    setLookupHint(
      phoneOnly
        ? "Nous trouvons une réservation à ce numéro, mais le nom ne correspond pas. Réessayez avec le prénom, le nom de famille, ou l'autre nom si vous étiez plusieurs."
        : "Aucune réservation à venir n'a été trouvée pour ce numéro."
    );
  }

  function startEdit(r) {
    setEditing(r);
    setEditParty(r.partySize);
    setEditNote(r.note || "");
    setDate(String(r.requestedAt).slice(0, 10));
    setSlots([]);
    setErr(null);
    setScreen("manage-edit");
  }

  // Édition directe de la note depuis la liste (sans changer le créneau).
  async function saveMatchNote(r, value) {
    const v = value.trim();
    if (v === (r.note || "")) return;
    try {
      await updateReservation(r.id, { note: v || null });
      setMatches((ms) => ms.map((m) => (m.id === r.id ? { ...m, note: v || null } : m)));
    } catch (e) {
      console.error(e);
      setErr("La note n'a pas pu être enregistrée.");
    }
  }

  async function loadEditSlots() {
    setErr(null);
    setBusy(true);
    try {
      setSlots(await runFeasibility(date, editParty, { excludeReservationId: editing.id }));
      setScreen("manage-slots");
    } catch (e) {
      console.error(e);
      setErr("Impossible de récupérer les créneaux. Réessayez dans un instant.");
    } finally {
      setBusy(false);
    }
  }

  async function applyEdit(slot) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await updateReservation(editing.id, {
        partySize: editParty,
        requestedAt: buildRequestedAtISO(date, slot.startMin),
        estimatedDurationMinutes: slot.durationMin,
        note: editNote.trim() || null,
      });
      setConfirmed({ name: editing.customerName, party: editParty, date, startMin: slot.startMin });
      setManageOutcome("modified");
      setScreen("manage-done");
    } catch (e) {
      console.error(e);
      setErr("La modification n'a pas pu être enregistrée. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelReservation(r) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await updateReservation(r.id, { status: "cancelled" });
      setConfirmed({ name: r.customerName, party: r.partySize, date: String(r.requestedAt).slice(0, 10), startMin: null });
      setManageOutcome("cancelled");
      setScreen("manage-done");
    } catch (e) {
      console.error(e);
      setErr("L'annulation n'a pas pu être enregistrée. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  function resetAll() {
    setScreen("form");
    setName("");
    setPhone("");
    setParty(2);
    setDate(todayISO());
    setSlots([]);
    setNote("");
    setConfirmed(null);
    setErr(null);
    setLookupPhone("");
    setLookupName("");
    setMatches([]);
    setLookupHint(null);
    setEditing(null);
    setEditParty(2);
    setEditNote("");
    setManageOutcome(null);
    setConfirmCancelId(null);
  }

  const backBtn = (onClick, label = "← Retour") => (
    <button onClick={onClick} className="text-[#b9a692] text-sm font-semibold tap-scale mb-4">
      {label}
    </button>
  );

  // Grille de créneaux groupés par service, `onPick(slot)` au clic.
  function renderSlots(onPick) {
    if (slots.length === 0) return null;
    return (
      <div className="flex flex-col gap-5">
        {slotGroups.map((g) => (
          <div key={`${g.label}-${g.minStart}`}>
            <div className="text-sm font-bold mb-2" style={{ color: "#e8622c" }}>
              {g.label}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {g.items.map((s) => (
                <button
                  key={`${g.label}-${s.startMin}`}
                  onClick={() => onPick(s)}
                  disabled={busy}
                  className="tap-scale rounded-xl py-3 font-bold border-2 disabled:opacity-40"
                  style={{ borderColor: "#e8622c", color: "#f5ebdd" }}
                >
                  {hhmm(s.startMin)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // --- écran confirmation (nouvelle réservation) ---
  if (screen === "done" && confirmed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={dark}>
        <span className="text-6xl mb-4">✅</span>
        <h1 className="display-font text-3xl font-semibold mb-2">Réservation confirmée</h1>
        <p className="text-[#f5ebdd] text-lg">
          {confirmed.name} · {confirmed.party} personne{confirmed.party > 1 ? "s" : ""}
        </p>
        <p className="text-[#e8622c] text-xl font-bold mt-1">
          {prettyDate(confirmed.date)} à {hhmm(confirmed.startMin)}
        </p>
        <p className="text-[#b9a692] text-sm mt-4 max-w-sm">{REMINDER}</p>
        <button onClick={resetAll} className="tap-scale mt-8 rounded-full px-6 py-3 font-bold" style={{ background: "#e8622c", color: "#150e0a" }}>
          Nouvelle réservation
        </button>
      </div>
    );
  }

  // --- écran créneaux (nouvelle réservation) ---
  if (screen === "slots") {
    return (
      <div className="min-h-screen px-6 py-8 max-w-md mx-auto" style={dark}>
        {backBtn(() => setScreen("form"), "← Modifier")}
        <h1 className="display-font text-2xl font-semibold mb-1">{restaurant.name}</h1>
        <p className="text-[#b9a692] text-sm mb-4">
          {party} personne{party > 1 ? "s" : ""} · {prettyDate(date)}
        </p>

        <div className="rounded-xl p-4 mb-5 text-sm" style={{ background: "#1c1410", border: "1px solid #3a2a1f", color: "#c9b8a4" }}>
          {REMINDER}
        </div>

        {slots.length === 0 ? (
          <p className="text-[#b9a692]">
            Aucun créneau disponible ce jour-là pour {party} personne{party > 1 ? "s" : ""}. Essayez une autre date.
          </p>
        ) : (
          <>
            <div className="text-xs text-[#8a7561] uppercase font-bold mb-3">Créneaux disponibles</div>
            {renderSlots(book)}
          </>
        )}
        {err && <p className="text-sm mt-4" style={{ color: "#e88a8a" }}>{err}</p>}
      </div>
    );
  }

  // --- retrouver une réservation ---
  if (screen === "manage-find") {
    return (
      <div className="min-h-screen px-6 py-8 max-w-md mx-auto" style={dark}>
        {backBtn(resetAll)}
        <h1 className="display-font text-2xl font-semibold mb-1">{restaurant.name}</h1>
        <p className="text-[#b9a692] text-sm mb-5">Retrouver ma réservation</p>

        <label className="block mb-3">
          <span className="text-xs text-[#a88f78] uppercase font-bold">Téléphone de la réservation</span>
          <input value={lookupPhone} onChange={(e) => setLookupPhone(e.target.value)} type="tel" className="w-full rounded-xl px-4 py-3 mt-1" style={inputStyle} placeholder="06 12 34 56 78" />
        </label>
        <label className="block mb-2">
          <span className="text-xs text-[#a88f78] uppercase font-bold">Nom</span>
          <input value={lookupName} onChange={(e) => setLookupName(e.target.value)} className="w-full rounded-xl px-4 py-3 mt-1" style={inputStyle} placeholder="Nom de la réservation" />
        </label>
        <p className="text-xs text-[#8a7561] mb-5">
          Indiquez le nom utilisé pour la réservation : un prénom, un nom de famille, ou l'un des deux noms si vous
          étiez plusieurs, suffisent.
        </p>

        {err && <p className="text-sm mb-3" style={{ color: "#e88a8a" }}>{err}</p>}
        {lookupHint && <p className="text-sm mb-3" style={{ color: "#e8b23d" }}>{lookupHint}</p>}

        <button
          onClick={findReservation}
          disabled={busy}
          className="tap-scale w-full rounded-full py-4 text-lg font-bold disabled:opacity-40"
          style={{ background: "#e8622c", color: "#150e0a" }}
        >
          Retrouver ma réservation
        </button>
      </div>
    );
  }

  // --- liste des réservations trouvées ---
  if (screen === "manage-list") {
    return (
      <div className="min-h-screen px-6 py-8 max-w-md mx-auto" style={dark}>
        {backBtn(() => setScreen("manage-find"))}
        <h1 className="display-font text-2xl font-semibold mb-1">{restaurant.name}</h1>
        <p className="text-[#b9a692] text-sm mb-5">
          {matches.length} réservation{matches.length > 1 ? "s" : ""} à venir
        </p>

        <div className="flex flex-col gap-3">
          {matches.map((r) => (
            <div key={r.id} className="rounded-xl p-4" style={{ background: "#1c1410", border: "1px solid #3a2a1f" }}>
              <p className="font-bold capitalize">{prettyDate(String(r.requestedAt).slice(0, 10))}</p>
              <p className="text-[#e8622c] text-lg font-bold">
                {hhmm(Number(String(r.requestedAt).slice(11, 13)) * 60 + Number(String(r.requestedAt).slice(14, 16)))}
              </p>
              <p className="text-[#b9a692] text-sm">
                {r.partySize} personne{r.partySize > 1 ? "s" : ""} · {r.customerName}
              </p>

              <div className="mt-2">
                <div className="text-xs text-[#a88f78] mb-1">Note (chaise bébé, allergie…)</div>
                <input
                  defaultValue={r.note || ""}
                  key={r.note || ""}
                  onBlur={(e) => saveMatchNote(r, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  placeholder="Aucune note"
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={inputStyle}
                />
                {r.note && <div className="mt-1"><ResaNote note={r.note} /></div>}
              </div>

              <div className="flex items-center gap-3 mt-3">
                <button
                  onClick={() => startEdit(r)}
                  className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2"
                  style={{ borderColor: "#e8622c", color: "#f5ebdd" }}
                >
                  Modifier
                </button>
                {confirmCancelId === r.id ? (
                  <button
                    onClick={() => cancelReservation(r)}
                    disabled={busy}
                    className="tap-scale rounded-full px-4 py-2 text-sm font-bold disabled:opacity-40"
                    style={{ background: "#C0392B", color: "#fff5ea" }}
                  >
                    Confirmer l'annulation
                  </button>
                ) : (
                  <button onClick={() => setConfirmCancelId(r.id)} className="tap-scale text-sm text-red-400 font-bold">
                    Annuler
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {err && <p className="text-sm mt-4" style={{ color: "#e88a8a" }}>{err}</p>}
      </div>
    );
  }

  // --- modifier : nombre de personnes ---
  if (screen === "manage-edit" && editing) {
    return (
      <div className="min-h-screen px-6 py-8 max-w-md mx-auto" style={dark}>
        {backBtn(() => setScreen("manage-list"))}
        <h1 className="display-font text-2xl font-semibold mb-1">Modifier ma réservation</h1>
        <p className="text-[#b9a692] text-sm mb-5">
          Actuellement : {editing.partySize} personne{editing.partySize > 1 ? "s" : ""} · {prettyDate(date)} à{" "}
          {hhmm(Number(String(editing.requestedAt).slice(11, 13)) * 60 + Number(String(editing.requestedAt).slice(14, 16)))}
        </p>

        <div className="mb-3">
          <span className="text-xs text-[#a88f78] uppercase font-bold">Nombre de personnes</span>
          <PartyStepper value={editParty} onChange={setEditParty} />
        </div>

        <label className="block mb-3">
          <span className="text-xs text-[#a88f78] uppercase font-bold">Note <span className="normal-case text-[#5a4a3a]">(ex. chaise bébé)</span></span>
          <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={2} className="w-full rounded-xl px-4 py-3 mt-1" style={inputStyle} />
        </label>

        <p className="text-xs text-[#8a7561] mb-5">
          Le changement de jour n'est pas possible ici : annulez puis reprenez une réservation pour une autre date.
        </p>

        {err && <p className="text-sm mb-3" style={{ color: "#e88a8a" }}>{err}</p>}

        <button
          onClick={loadEditSlots}
          disabled={busy}
          className="tap-scale w-full rounded-full py-4 text-lg font-bold disabled:opacity-40"
          style={{ background: "#e8622c", color: "#150e0a" }}
        >
          {busy ? "Recherche…" : "Voir les créneaux disponibles"}
        </button>
      </div>
    );
  }

  // --- modifier : choix du nouveau créneau ---
  if (screen === "manage-slots" && editing) {
    return (
      <div className="min-h-screen px-6 py-8 max-w-md mx-auto" style={dark}>
        {backBtn(() => setScreen("manage-edit"))}
        <h1 className="display-font text-2xl font-semibold mb-1">Nouveau créneau</h1>
        <p className="text-[#b9a692] text-sm mb-5">
          {editParty} personne{editParty > 1 ? "s" : ""} · {prettyDate(date)}
        </p>

        {slots.length === 0 ? (
          <p className="text-[#b9a692]">
            Aucun créneau disponible pour {editParty} personne{editParty > 1 ? "s" : ""} ce jour-là. Réduisez le nombre
            de personnes ou annulez la réservation.
          </p>
        ) : (
          <>
            <div className="text-xs text-[#8a7561] uppercase font-bold mb-3">Créneaux disponibles</div>
            {renderSlots(applyEdit)}
          </>
        )}
        {err && <p className="text-sm mt-4" style={{ color: "#e88a8a" }}>{err}</p>}
      </div>
    );
  }

  // --- confirmation (modif / annulation) ---
  if (screen === "manage-done" && confirmed) {
    const cancelled = manageOutcome === "cancelled";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={dark}>
        <span className="text-6xl mb-4">{cancelled ? "🗑️" : "✅"}</span>
        <h1 className="display-font text-3xl font-semibold mb-2">
          {cancelled ? "Réservation annulée" : "Réservation modifiée"}
        </h1>
        <p className="text-[#f5ebdd] text-lg">
          {confirmed.name} · {confirmed.party} personne{confirmed.party > 1 ? "s" : ""}
        </p>
        {!cancelled && (
          <p className="text-[#e8622c] text-xl font-bold mt-1">
            {prettyDate(confirmed.date)} à {hhmm(confirmed.startMin)}
          </p>
        )}
        <button onClick={resetAll} className="tap-scale mt-8 rounded-full px-6 py-3 font-bold" style={{ background: "#e8622c", color: "#150e0a" }}>
          Terminé
        </button>
      </div>
    );
  }

  // --- écran formulaire (nouvelle réservation) ---
  return (
    <div className="min-h-screen px-6 py-8 max-w-md mx-auto" style={dark}>
      <div className="text-center mb-6">
        <span className="text-5xl">🍽️</span>
        <h1 className="display-font text-3xl font-semibold mt-2">{restaurant.name}</h1>
        <p className="text-[#b9a692] text-sm">Réserver une table</p>
      </div>

      <label className="block mb-3">
        <span className="text-xs text-[#a88f78] uppercase font-bold">Nom</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl px-4 py-3 mt-1" style={inputStyle} placeholder="Votre nom" />
      </label>
      <label className="block mb-3">
        <span className="text-xs text-[#a88f78] uppercase font-bold">Téléphone</span>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className="w-full rounded-xl px-4 py-3 mt-1" style={inputStyle} placeholder="06 12 34 56 78" />
      </label>

      <label className="block mb-3">
        <span className="text-xs text-[#a88f78] uppercase font-bold">Note <span className="normal-case text-[#5a4a3a]">(facultatif)</span></span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Ex. ajouter une chaise bébé, allergie…" className="w-full rounded-xl px-4 py-3 mt-1" style={inputStyle} />
      </label>

      <div className="mb-3">
        <span className="text-xs text-[#a88f78] uppercase font-bold">Nombre de personnes</span>
        <PartyStepper value={party} onChange={setParty} />
      </div>

      <label className="block mb-5">
        <span className="text-xs text-[#a88f78] uppercase font-bold">Date</span>
        <input value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} type="date" className="w-full rounded-xl px-4 py-3 mt-1" style={inputStyle} />
      </label>

      {err && <p className="text-sm mb-3" style={{ color: "#e88a8a" }}>{err}</p>}

      <button
        onClick={search}
        disabled={busy}
        className="tap-scale w-full rounded-full py-4 text-lg font-bold disabled:opacity-40"
        style={{ background: "#e8622c", color: "#150e0a" }}
      >
        {busy ? "Recherche…" : "Voir les créneaux"}
      </button>

      <button
        onClick={() => {
          setErr(null);
          setLookupHint(null);
          setScreen("manage-find");
        }}
        className="tap-scale w-full text-center text-sm text-[#b9a692] font-semibold mt-4 underline"
      >
        J'ai déjà une réservation à modifier ou annuler
      </button>
    </div>
  );
}
