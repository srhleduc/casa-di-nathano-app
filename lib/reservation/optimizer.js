// Moteur d'optimisation de salle — pur, sans I/O.
//
// À partir des tables, des combinaisons valides (table_combinations) et des
// réservations d'un service (avec leur intervalle d'occupation), cherche la
// meilleure affectation GLOBALE : maximiser les réservations acceptées et les
// couverts, sans gaspiller de capacité ni fragmenter inutilement, en gardant
// les combinaisons utiles pour les gros groupes (cahier des charges §8-§12).
//
// Approche (brief) : pas d'optimum exhaustif (NP-difficile). Glouton — on
// place les gros groupes d'abord, ce qui préserve naturellement les
// combinaisons — puis recherche locale (réaffectations + acceptation des
// réservations restées non placées).

const ACCEPT_BONUS = 1000;
const COVER_BONUS = 100;
const WASTE_PENALTY = 15;
const FRAGMENT_PENALTY = 5; // par table au-delà de la première

// Intervalles [start, start+dur) qui se chevauchent ?
function overlaps(aStart, aDur, bStart, bDur) {
  return aStart < bStart + bDur && bStart < aStart + aDur;
}

// Options d'assise possibles pour un groupe de `partySize` : chaque table seule
// assez grande, chaque combinaison assez grande.
function seatingOptionsFor(partySize, tables, combinations) {
  const opts = [];
  for (const t of tables) {
    if (t.active !== false && (t.capacityBase ?? 2) >= partySize) {
      opts.push({ kind: "table", tableIds: [t.id], capacity: t.capacityBase ?? 2, penalty: 0 });
    }
  }
  for (const c of combinations || []) {
    if ((c.capacity ?? 0) >= partySize && Array.isArray(c.tableIds) && c.tableIds.length) {
      opts.push({ kind: "combo", tableIds: [...c.tableIds], capacity: c.capacity, penalty: c.penaltyScore || 0, comboId: c.id });
    }
  }
  return opts;
}

// Score local d'une affectation d'une réservation à une option.
function optionScore(partySize, opt) {
  const waste = Math.max(0, opt.capacity - partySize);
  const frag = Math.max(0, opt.tableIds.length - 1) * FRAGMENT_PENALTY;
  return ACCEPT_BONUS + COVER_BONUS * partySize - WASTE_PENALTY * waste - opt.penalty - frag;
}

// Une option est-elle libre pour `res` compte tenu des autres affectations ?
function optionFeasible(opt, res, assignmentsByRes, resById) {
  for (const [otherId, a] of Object.entries(assignmentsByRes)) {
    if (otherId === res.id || !a) continue;
    const other = resById[otherId];
    if (!other) continue;
    if (!overlaps(res.startMin, res.durationMin, other.startMin, other.durationMin)) continue;
    for (const tid of opt.tableIds) {
      if (a.tableIds.includes(tid)) return false;
    }
  }
  return true;
}

function totalScore(assignmentsByRes, resById) {
  let s = 0;
  for (const [rid, a] of Object.entries(assignmentsByRes)) {
    if (a) s += optionScore(resById[rid].partySize, a);
  }
  return s;
}

// input : { tables, combinations, reservations:[{id,partySize,startMin,durationMin}],
//           safetyMarginMinutes }
export function solve(input) {
  const safety = Number(input.safetyMarginMinutes) || 0;
  const reservations = (input.reservations || []).map((r) => ({
    id: String(r.id),
    partySize: Number(r.partySize),
    startMin: Number(r.startMin),
    durationMin: Number(r.durationMin) + safety,
  }));
  const resById = Object.fromEntries(reservations.map((r) => [r.id, r]));
  const tables = input.tables || [];
  const combinations = input.combinations || [];

  const optionsByRes = {};
  for (const r of reservations) {
    optionsByRes[r.id] = seatingOptionsFor(r.partySize, tables, combinations)
      .map((o) => ({ ...o, _score: optionScore(r.partySize, o) }))
      .sort((a, b) => b._score - a._score);
  }

  // --- glouton : gros groupes d'abord, puis heure ---
  const order = [...reservations].sort((a, b) => b.partySize - a.partySize || a.startMin - b.startMin);
  const assign = {};
  for (const r of reservations) assign[r.id] = null;
  for (const r of order) {
    for (const opt of optionsByRes[r.id]) {
      if (optionFeasible(opt, r, assign, resById)) {
        assign[r.id] = opt;
        break;
      }
    }
  }

  // --- recherche locale ---
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 200) {
    improved = false;
    // 1. accepter une réservation non placée si une option est devenue libre
    for (const r of reservations) {
      if (assign[r.id]) continue;
      for (const opt of optionsByRes[r.id]) {
        if (optionFeasible(opt, r, assign, resById)) {
          assign[r.id] = opt;
          improved = true;
          break;
        }
      }
    }
    // 2. réaffecter une réservation placée vers une meilleure option
    for (const r of reservations) {
      const cur = assign[r.id];
      if (!cur) continue;
      for (const opt of optionsByRes[r.id]) {
        if (opt === cur || opt._score <= cur._score) continue;
        const saved = assign[r.id];
        assign[r.id] = null;
        if (optionFeasible(opt, r, assign, resById)) {
          assign[r.id] = opt;
          improved = true;
          break;
        }
        assign[r.id] = saved;
      }
    }
  }

  const assignments = [];
  const unassigned = [];
  let covers = 0;
  for (const r of reservations) {
    const a = assign[r.id];
    if (a) {
      assignments.push({ reservationId: r.id, kind: a.kind, tableIds: a.tableIds, capacity: a.capacity, penalty: a.penalty, comboId: a.comboId || null });
      covers += r.partySize;
    } else {
      unassigned.push(r.id);
    }
  }
  return {
    assignments,
    unassigned,
    accepted: assignments.length,
    covers,
    totalScore: totalScore(assign, resById),
  };
}

// Pour /reserver : parmi `candidateSlots` (mêmes champs qu'une réservation,
// sans id), lesquels peuvent être acceptés SANS déloger une réservation
// existante ?
export function feasibleSlots(input, candidateSlots) {
  const existing = input.reservations || [];
  const existingIds = new Set(existing.map((r) => String(r.id)));
  const out = [];
  for (let i = 0; i < candidateSlots.length; i++) {
    const cand = { ...candidateSlots[i], id: `__cand_${i}` };
    const res = solve({ ...input, reservations: [...existing, cand] });
    const candOk = !res.unassigned.includes(cand.id);
    const existingOk = res.unassigned.every((id) => !existingIds.has(id));
    if (candOk && existingOk) out.push({ ...candidateSlots[i] });
  }
  return out;
}
