"use client";

// Appel du moteur d'optimisation (Route Handler /api/reservations/solve).
// `input` : { tables, combinations, reservations, safetyMarginMinutes,
//             candidateSlots? }. Voir lib/reservation/optimizer.js pour le
//             format exact des entrées/sorties.
export async function solveReservations(input) {
  const res = await fetch("/api/reservations/solve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Échec du moteur d'optimisation (${res.status})`);
  return json;
}
