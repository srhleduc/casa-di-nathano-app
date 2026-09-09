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

// Capacité max d'une table (jusqu'où on peut la pousser) et capacité préférée
// (cible de remplissage). Rétrocompatibles : `capacityBase` seul → les deux.
function tableCapMax(t) {
  return Number(t.capacityMax ?? t.capacityBase ?? t.capacityPreferred ?? 2) || 2;
}
function tableCapPreferred(t) {
  return Number(t.capacityPreferred ?? t.capacityBase ?? tableCapMax(t)) || tableCapMax(t);
}

// Options d'assise possibles pour un groupe de `partySize` : chaque table seule
// assez grande, chaque combinaison assez grande. Les tables inactives ou
// bloquées ne sont jamais proposées au moteur (une table bloquée reste
// affectable manuellement par l'équipe via `pinned`).
// Rang de remplissage : priority_order si défini, sinon très grand (les tables
// sans priorité passent après). NaN impossible (contrairement à `?? Infinity`
// dont la soustraction Infinity - Infinity donne NaN et casse le tri).
const NO_PRIORITY = Number.MAX_SAFE_INTEGER;
function priorityRank(t) {
  const v = Number(t?.priorityOrder);
  return Number.isFinite(v) ? v : NO_PRIORITY;
}

function seatingOptionsFor(partySize, tables, combinations) {
  const opts = [];
  // `idx` = position de la table dans input.tables : dernier bris d'égalité,
  // pour que le moteur suive l'ordre dans lequel le client envoie les tables
  // (déjà trié par priorité de remplissage) quand priority_order est absent.
  tables.forEach((t, idx) => {
    if (t.active === false || t.blocked === true) return;
    if (tableCapMax(t) >= partySize) {
      opts.push({
        kind: "table",
        tableIds: [t.id],
        capacity: tableCapMax(t),
        preferred: tableCapPreferred(t),
        priorityRank: priorityRank(t),
        idx,
        penalty: 0,
      });
    }
  });
  for (const c of combinations || []) {
    if ((c.capacity ?? 0) >= partySize && Array.isArray(c.tableIds) && c.tableIds.length) {
      opts.push({
        kind: "combo",
        tableIds: [...c.tableIds],
        capacity: c.capacity,
        preferred: c.capacity,
        priorityRank: NO_PRIORITY,
        idx: Number.MAX_SAFE_INTEGER,
        penalty: c.penaltyScore || 0,
        comboId: c.id,
      });
    }
  }
  return opts;
}

// Score local d'une affectation d'une réservation à une option. Le gaspillage
// se mesure par rapport à la capacité PRÉFÉRÉE (pousser une petite table à son
// max coûte autant que sous-occuper une grande table).
function optionScore(partySize, opt) {
  const ref = opt.preferred ?? opt.capacity;
  const waste = Math.abs(ref - partySize);
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

// input : { tables:[{id,active,blocked,capacityMin,capacityPreferred,capacityMax,
//             capacityBase?,priorityOrder}], combinations,
//           reservations:[{id,partySize,startMin,durationMin}], safetyMarginMinutes }
// `capacityBase` seul reste accepté (= préférée ET max) pour la rétrocompat.
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
      // À score égal : priorité de remplissage (priority_order), puis ordre
      // d'arrivée des tables dans l'entrée (déjà trié côté client par
      // priorité + nom). Bris d'égalité pur — n'altère ni l'acceptation ni
      // le calcul de gaspillage.
      .sort((a, b) => b._score - a._score || a.priorityRank - b.priorityRank || a.idx - b.idx);
  }

  // Affectations forcées par l'équipe (reservation_table_assignments manuels) :
  // figées, jamais réaffectées, mais occupent bien leurs tables pour les autres.
  const pinnedIn = input.pinned || {};
  const pinnedIds = new Set();
  const assign = {};
  for (const r of reservations) assign[r.id] = null;
  for (const r of reservations) {
    const p = pinnedIn[r.id];
    if (p && Array.isArray(p.tableIds) && p.tableIds.length) {
      const opt = { kind: p.tableIds.length > 1 ? "combo" : "table", tableIds: [...p.tableIds], capacity: p.capacity ?? r.partySize, penalty: 0, comboId: p.comboId || null, manual: true, _score: 0 };
      assign[r.id] = opt;
      pinnedIds.add(r.id);
    }
  }

  // --- glouton : gros groupes d'abord, puis heure (hors réservations figées) ---
  const order = [...reservations]
    .filter((r) => !pinnedIds.has(r.id))
    .sort((a, b) => b.partySize - a.partySize || a.startMin - b.startMin);
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
      if (assign[r.id] || pinnedIds.has(r.id)) continue;
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
      if (pinnedIds.has(r.id)) continue;
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
      assignments.push({ reservationId: r.id, kind: a.kind, tableIds: a.tableIds, capacity: a.capacity, penalty: a.penalty, comboId: a.comboId || null, manual: !!a.manual });
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
