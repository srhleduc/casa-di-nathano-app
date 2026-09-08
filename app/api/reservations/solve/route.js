// Route Handler du moteur d'optimisation de salle. Calcul PUR sur des données
// fournies par le client (tables, combinaisons, réservations du service) — pas
// d'accès base, pas de secret. Le client (page /reserver, board équipe) envoie
// tout le contexte et récupère l'affectation optimale.

import { NextResponse } from "next/server";
import { solve, feasibleSlots } from "@/lib/reservation/optimizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RESERVATIONS = 300;
const MAX_TABLES = 200;
const MAX_COMBOS = 1000;
const MAX_SLOTS = 200;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const tables = Array.isArray(body.tables) ? body.tables : [];
  const combinations = Array.isArray(body.combinations) ? body.combinations : [];
  const reservations = Array.isArray(body.reservations) ? body.reservations : [];
  const candidateSlots = Array.isArray(body.candidateSlots) ? body.candidateSlots : null;

  if (
    reservations.length > MAX_RESERVATIONS ||
    tables.length > MAX_TABLES ||
    combinations.length > MAX_COMBOS ||
    (candidateSlots && candidateSlots.length > MAX_SLOTS)
  ) {
    return NextResponse.json({ error: "Trop de données" }, { status: 413 });
  }

  const input = {
    tables,
    combinations,
    reservations,
    safetyMarginMinutes: Number(body.safetyMarginMinutes) || 0,
  };

  try {
    const result = solve(input);
    if (candidateSlots) {
      result.feasibleSlots = feasibleSlots(input, candidateSlots);
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Échec du calcul" }, { status: 500 });
  }
}
