"use client";

// Page publique /reserver : le client saisit nom + téléphone + nombre de
// personnes + date, on ne lui propose que des créneaux RÉELLEMENT compatibles
// avec la salle, les réservations déjà en place et les services actifs ce
// jour-là (moteur d'optimisation, /api/reservations/solve). La complexité du
// plan de salle n'est jamais exposée. Aucun accès équipe (comme /sat).

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
} from "@/lib/data";
import { servicesForDate } from "@/lib/reservation/services";
import { buildCandidateSlots, buildRequestedAtISO, reservationsForSolver } from "@/lib/reservation/slots";
import { solveReservations } from "@/lib/reservation/api";

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

export default function ReservationBooking() {
  const restaurant = useRestaurant();
  const { settings } = useReservationSettings();
  const { serviceTemplates } = useServiceTemplates();
  const { serviceOverrides } = useServiceOverrides();
  const { serviceExceptions } = useServiceExceptions();
  const { tables } = useTables();
  const { combinations } = useTableCombinations();
  const { reservations } = useReservations();

  const [screen, setScreen] = useState("form"); // form | slots | done
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [party, setParty] = useState(2);
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [slots, setSlots] = useState([]); // [{ startMin, durationMin, serviceLabel }]
  const [confirmed, setConfirmed] = useState(null); // { name, party, date, startMin }

  const services = useMemo(
    () => servicesForDate(date, serviceTemplates, serviceOverrides, serviceExceptions),
    [date, serviceTemplates, serviceOverrides, serviceExceptions]
  );

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

  async function search() {
    setErr(null);
    if (!name.trim() || !phone.trim()) {
      setErr("Merci d'indiquer votre nom et votre numéro de téléphone.");
      return;
    }
    if (services.length === 0) {
      setSlots([]);
      setScreen("slots");
      return;
    }
    setBusy(true);
    try {
      const isToday = date === todayISO();
      const now = new Date();
      const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() : null;
      const candidateSlots = buildCandidateSlots(services, settings, party, { nowMin });
      const input = {
        // Réservation en ligne : seules les tables actives, cochées « disponible
        // en ligne » et non bloquées peuvent être proposées.
        tables: tables
          .filter((t) => t.active && (t.bookableOnline ?? true) && !t.blocked)
          .map((t) => ({
            id: t.id,
            capacityMin: t.capacityMin,
            capacityPreferred: t.capacityPreferred,
            capacityMax: t.capacityMax,
            capacityBase: t.capacityBase,
            priorityOrder: t.priorityOrder,
            active: true,
          })),
        combinations: combinations.map((c) => ({ id: c.id, tableIds: c.tableIds, capacity: c.capacity, isUsual: c.isUsual, penaltyScore: c.penaltyScore })),
        reservations: reservationsForSolver(reservations, date),
        safetyMarginMinutes: settings.safetyMarginMinutes || 0,
        candidateSlots,
      };
      const res = await solveReservations(input);
      const feasible = (res.feasibleSlots || []).slice().sort((a, b) => a.startMin - b.startMin);
      setSlots(feasible);
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

  function resetAll() {
    setScreen("form");
    setName("");
    setPhone("");
    setParty(2);
    setDate(todayISO());
    setSlots([]);
    setConfirmed(null);
    setErr(null);
  }

  // --- écran confirmation ---
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
        <button
          onClick={resetAll}
          className="tap-scale mt-8 rounded-full px-6 py-3 font-bold"
          style={{ background: "#e8622c", color: "#150e0a" }}
        >
          Nouvelle réservation
        </button>
      </div>
    );
  }

  // --- écran créneaux ---
  if (screen === "slots") {
    return (
      <div className="min-h-screen px-6 py-8 max-w-md mx-auto" style={dark}>
        <button onClick={() => setScreen("form")} className="text-[#b9a692] text-sm font-semibold tap-scale mb-4">
          ← Modifier
        </button>
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
                        onClick={() => book(s)}
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
          </>
        )}
        {err && <p className="text-sm mt-4" style={{ color: "#e88a8a" }}>{err}</p>}
      </div>
    );
  }

  // --- écran formulaire ---
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

      <div className="mb-3">
        <span className="text-xs text-[#a88f78] uppercase font-bold">Nombre de personnes</span>
        <div className="flex items-center gap-4 mt-1">
          <button onClick={() => setParty((p) => Math.max(1, p - 1))} className="tap-scale w-11 h-11 rounded-full text-2xl font-bold" style={{ background: "#1c1410", border: "1px solid #3a2a1f" }}>
            −
          </button>
          <span className="text-2xl font-bold w-10 text-center">{party}</span>
          <button onClick={() => setParty((p) => Math.min(20, p + 1))} className="tap-scale w-11 h-11 rounded-full text-2xl font-bold" style={{ background: "#1c1410", border: "1px solid #3a2a1f" }}>
            +
          </button>
        </div>
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
    </div>
  );
}
