// Construction des créneaux candidats pour la page /reserver + mise en forme
// des réservations existantes pour le moteur. Pur, sans I/O.

import { toHHMM } from "./services.js";

// Durée d'occupation estimée par taille de groupe (cahier des charges §9,
// point de départ, à affiner avec les données réelles arrivée/départ).
export function estimateDurationMin(partySize) {
  if (partySize <= 2) return 75;
  if (partySize <= 4) return 90;
  if (partySize <= 6) return 105;
  return 105 + (partySize - 6) * 10;
}

// ISO « heure murale » (sans fuseau) : on stocke et relit toujours le même
// HH:MM littéral, sans jamais faire de calcul de fuseau dessus.
export function buildRequestedAtISO(dateStr, minutes) {
  return `${dateStr}T${toHHMM(minutes)}:00`;
}

// Créneaux candidats d'une date : un pas de `slotGranularityMinutes` dans
// chaque service actif, tant que `début + durée <= fin du service` (un créneau
// ne chevauche jamais deux services). `nowMin` (si la date est aujourd'hui) :
// on écarte les créneaux trop proches (< nowMin + leadMin).
export function buildCandidateSlots(services, settings, partySize, { nowMin = null, leadMin = 30 } = {}) {
  const gran = Number(settings?.slotGranularityMinutes) || 15;
  const dur = estimateDurationMin(partySize);
  const out = [];
  for (const s of services) {
    for (let m = s.startMin; m + dur <= s.endMin; m += gran) {
      if (nowMin != null && m < nowMin + leadMin) continue;
      out.push({ startMin: m, partySize, durationMin: dur, serviceNumber: s.serviceNumber, serviceLabel: s.label });
    }
  }
  return out;
}

// Réservations existantes → format attendu par le moteur, filtrées sur la date
// et les statuts actifs. On lit le HH:MM littéral de requested_at (voir
// buildRequestedAtISO) sans conversion de fuseau.
export function reservationsForSolver(reservations, dateStr) {
  const out = [];
  for (const r of reservations || []) {
    if (!["confirmed", "seated"].includes(r.status)) continue;
    if (String(r.requestedAt || "").slice(0, 10) !== dateStr) continue;
    const m = /T(\d\d):(\d\d)/.exec(r.requestedAt || "");
    if (!m) continue;
    out.push({
      id: r.id,
      partySize: r.partySize,
      startMin: Number(m[1]) * 60 + Number(m[2]),
      durationMin: r.estimatedDurationMinutes || estimateDurationMin(r.partySize),
    });
  }
  return out;
}
