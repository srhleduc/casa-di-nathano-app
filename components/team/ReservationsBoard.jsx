"use client";

// Board réservation (cahier des charges §14-§15) : plan visuel avec statuts,
// synthèse de service, et mode manuel (forcer une affectation, avec
// avertissement si la config est inhabituelle). Le moteur d'optimisation
// (/api/reservations/solve) propose l'affectation ; l'équipe peut la forcer.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRestaurant } from "@/lib/restaurant";
import {
  useReservationSettings,
  useServiceTemplates,
  useServiceOverrides,
  useServiceExceptions,
  useTables,
  useTableCombinations,
  useReservations,
  useRoomLayouts,
  useReservationTableAssignments,
  setReservationTables,
  clearReservationTables,
  updateReservation,
} from "@/lib/data";
import { servicesForDate } from "@/lib/reservation/services";
import { reservationsForSolver, estimateDurationMin } from "@/lib/reservation/slots";
import { computeTableStatuses, serviceSynthesis } from "@/lib/reservation/board";
import { solveReservations } from "@/lib/reservation/api";
import { tableDisplayName, sortByFillPriority } from "@/lib/business";

const todayISO = () => new Date().toISOString().slice(0, 10);
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}h${String(m % 60).padStart(2, "0")}`;
const startMinOf = (r) => {
  const m = /T(\d\d):(\d\d)/.exec(r.requestedAt || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};

const STATUS_STYLE = {
  libre: { bg: "#16281c", border: "#2f9e5e", label: "Disponible" },
  reservee: { bg: "#33300f", border: "#c9a83a", label: "À venir" },
  occupee: { bg: "#2c1c14", border: "#c0503a", label: "Occupée" },
  bientot: { bg: "#3a2a12", border: "#d98a2b", label: "Bientôt dispo" },
  groupee: { bg: "#1a2740", border: "#3f6ab5", label: "Groupée" },
  a_renouveler: { bg: "#2b1a3a", border: "#9a5ad9", label: "À renouveler" },
  terminee: { bg: "#4a4a47", border: "#f0ede6", label: "Terminée" },
  bloquee: { bg: "#1a120b", border: "#3a2b1f", label: "Bloquée" },
};
const CELL = 46; // une case = une table (70 cm)

// PINK = rose « service » : contour du service en cours + tables réservées
// pour un service qu'on inspecte.
const PINK = "#D9689F";

function PlanView({ layout, placedTables, statuses, labelById, resById, highlightIds = null, noteByTable = null }) {
  if (!layout) return null;
  const cols = layout.gridCols || 12;
  const rows = layout.gridRows || 12;
  return (
    <div className="overflow-auto rounded-xl border border-[#3a2b1f] bg-[#1a120b] p-3">
      <div
        className="relative mx-auto"
        style={{
          width: cols * CELL,
          height: rows * CELL,
          backgroundImage:
            "repeating-linear-gradient(0deg,#211712,#211712 1px,transparent 1px,transparent " +
            CELL +
            "px),repeating-linear-gradient(90deg,#211712,#211712 1px,transparent 1px,transparent " +
            CELL +
            "px)",
        }}
      >
        {placedTables.map((t) => {
          const st = statuses[t.id]?.status || "libre";
          const s = STATUS_STYLE[st];
          const cur = statuses[t.id]?.current;
          const nxt = statuses[t.id]?.next;
          const sub = cur ? resById[cur] : nxt ? resById[nxt] : null;
          // Mode « plan d'un service » : les tables réservées pour ce service
          // sont entourées en rose, les autres estompées.
          const highlighted = highlightIds ? highlightIds.has(t.id) : false;
          const dim = highlightIds && !highlighted;
          const note = noteByTable?.[t.id] || null;
          return (
            <div
              key={t.id}
              title={`${labelById[t.id]} — ${s.label}`}
              className="absolute flex flex-col items-center justify-center rounded-md text-center overflow-hidden"
              style={{
                left: t.gridCol * CELL + 2,
                top: t.gridRow * CELL + 2,
                width: CELL - 4,
                height: CELL - 4,
                background: highlighted ? "#2c1a24" : s.bg,
                border: highlighted ? `2px solid ${PINK}` : `2px solid ${s.border}`,
                boxShadow: highlighted ? `0 0 0 2px ${PINK}55` : "none",
                opacity: dim ? 0.3 : 1,
                fontSize: 10,
                color: "#f5ebdd",
                fontWeight: 700,
              }}
            >
              <span>{labelById[t.id]}</span>
              {note ? (
                <span className="text-[8px] font-normal opacity-90">{note}</span>
              ) : (
                sub && <span className="text-[8px] font-normal opacity-80">{hhmm(startMinOf(sub))}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ReservationsBoard() {
  const restaurant = useRestaurant();
  const { settings } = useReservationSettings();
  const { serviceTemplates } = useServiceTemplates();
  const { serviceOverrides } = useServiceOverrides();
  const { serviceExceptions } = useServiceExceptions();
  const { tables } = useTables();
  const { combinations } = useTableCombinations();
  const { reservations } = useReservations();
  const { layouts } = useRoomLayouts();
  const { assignments: manualRows } = useReservationTableAssignments();

  const [date, setDate] = useState(todayISO());
  const [layoutId, setLayoutId] = useState(null);
  const [selectedServiceNum, setSelectedServiceNum] = useState(null);
  const [nowMin, setNowMin] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  const [solveResult, setSolveResult] = useState({ assignments: [], unassigned: [] });
  const lastSig = useRef("");

  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const isToday = date === todayISO();
  const services = useMemo(
    () => servicesForDate(date, serviceTemplates, serviceOverrides, serviceExceptions),
    [date, serviceTemplates, serviceOverrides, serviceExceptions]
  );

  const dayReservations = useMemo(
    () =>
      reservations
        .filter((r) => String(r.requestedAt || "").slice(0, 10) === date)
        .filter((r) => r.status !== "cancelled")
        .slice()
        .sort((a, b) => startMinOf(a) - startMinOf(b)),
    [reservations, date]
  );

  const labelById = useMemo(() => Object.fromEntries(tables.map((t) => [t.id, tableDisplayName(t)])), [tables]);
  const activeTables = useMemo(() => tables.filter((t) => t.active), [tables]);
  const comboById = useMemo(() => Object.fromEntries(combinations.map((c) => [c.id, c])), [combinations]);

  const manualByRes = useMemo(() => {
    const m = {};
    for (const a of manualRows) (m[a.reservationId] = m[a.reservationId] || []).push(a.tableId);
    return m;
  }, [manualRows]);

  // Choix du plan : premier avec des tables placées, sinon le premier.
  useEffect(() => {
    if (layoutId && layouts.some((l) => l.id === layoutId)) return;
    const withTables = layouts.find((l) => tables.some((t) => t.layoutId === l.id && t.gridRow != null));
    setLayoutId((withTables || layouts[0])?.id || null);
  }, [layouts, tables, layoutId]);

  const layout = layouts.find((l) => l.id === layoutId) || null;
  const placedTables = useMemo(
    () => tables.filter((t) => t.layoutId === layoutId && t.gridRow != null && t.gridCol != null),
    [tables, layoutId]
  );

  // --- appel du moteur (débouncé par signature) ---
  useEffect(() => {
    const existing = reservationsForSolver(reservations, date);
    const pinned = {};
    for (const [rid, tids] of Object.entries(manualByRes)) {
      const cap = tids.reduce((s, tid) => s + (tables.find((t) => t.id === tid)?.capacityBase || 2), 0);
      pinned[rid] = { tableIds: tids, capacity: cap };
    }
    const input = {
      // Tables triées dans l'ordre de remplissage voulu (priority_order puis
      // nom) → le moteur suit cet ordre à choix équivalent, même si aucun
      // priority_order n'est encore enregistré.
      tables: sortByFillPriority(activeTables).map((t) => ({
        id: t.id,
        capacityMin: t.capacityMin,
        capacityPreferred: t.capacityPreferred,
        capacityMax: t.capacityMax,
        capacityBase: t.capacityBase,
        blocked: t.blocked,
        priorityOrder: t.priorityOrder,
        active: true,
      })),
      combinations: combinations.map((c) => ({ id: c.id, tableIds: c.tableIds, capacity: c.capacity, isUsual: c.isUsual, penaltyScore: c.penaltyScore })),
      reservations: existing,
      safetyMarginMinutes: settings.safetyMarginMinutes || 0,
      pinned,
    };
    const sig = JSON.stringify(input);
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    if (!existing.length) {
      setSolveResult({ assignments: [], unassigned: [] });
      return;
    }
    let cancelled = false;
    solveReservations(input)
      .then((res) => !cancelled && setSolveResult(res))
      .catch((e) => console.error(e));
    return () => {
      cancelled = true;
    };
  }, [reservations, date, manualByRes, activeTables, combinations, settings.safetyMarginMinutes, tables]);

  const asgByRes = useMemo(() => {
    const m = {};
    for (const a of solveResult.assignments || []) m[a.reservationId] = a;
    return m;
  }, [solveResult]);

  const effectiveTables = (rid) => manualByRes[rid] || asgByRes[rid]?.tableIds || [];

  const boardReservations = useMemo(
    () => dayReservations.map((r) => ({ id: r.id, startMin: startMinOf(r), durationMin: r.estimatedDurationMinutes || estimateDurationMin(r.partySize), status: r.status, partySize: r.partySize })),
    [dayReservations]
  );
  const statuses = useMemo(
    () =>
      computeTableStatuses(
        placedTables,
        dayReservations.map((r) => ({ reservationId: r.id, tableIds: effectiveTables(r.id) })),
        boardReservations,
        nowMin,
        // Les états « à renouveler » / « terminée » ne valent que pour la
        // journée en cours (« ce jour uniquement »).
        { marginMin: settings.safetyMarginMinutes || 15, services: isToday ? services : [] }
      ),
    [placedTables, dayReservations, boardReservations, nowMin, manualByRes, asgByRes, settings.safetyMarginMinutes, isToday, services]
  );
  const nonPlacedActive = activeTables.filter((t) => !(t.layoutId === layoutId && t.gridRow != null));

  // Service en cours (uniquement si on regarde aujourd'hui) + service inspecté
  // en cliquant sur une carte de synthèse.
  const currentService = isToday ? services.find((s) => nowMin >= s.startMin && nowMin < s.endMin) || null : null;
  const selectedService = services.find((s) => s.serviceNumber === selectedServiceNum) || null;
  useEffect(() => setSelectedServiceNum(null), [date]);

  // Tables réservées à l'avance pour le service inspecté (affectation auto ou forcée).
  const selectedServiceInfo = useMemo(() => {
    if (!selectedService) return null;
    const rs = dayReservations.filter((r) => {
      const st = startMinOf(r);
      return st >= selectedService.startMin && st < selectedService.endMin;
    });
    const highlightIds = new Set();
    const noteByTable = {};
    for (const r of rs) {
      for (const tid of effectiveTables(r.id)) {
        highlightIds.add(tid);
        const tag = `${hhmm(startMinOf(r))} ${(r.customerName || "").split(" ")[0].slice(0, 7)}`.trim();
        noteByTable[tid] = noteByTable[tid] ? `${noteByTable[tid]} / ${tag}` : tag;
      }
    }
    return { reservations: rs, highlightIds, noteByTable, count: highlightIds.size };
  }, [selectedService, dayReservations, manualByRes, asgByRes]);

  const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };

  function forceTables(rid, value) {
    if (value === "auto") {
      clearReservationTables(rid).catch((e) => console.error(e));
      return;
    }
    if (value.startsWith("combo:")) {
      const c = comboById[value.slice(6)];
      if (c) setReservationTables(rid, c.tableIds).catch((e) => console.error(e));
    } else {
      setReservationTables(rid, [value]).catch((e) => console.error(e));
    }
  }
  function warnFor(r, tids) {
    if (!tids.length) return null;
    const cap = tids.reduce((s, tid) => s + (tables.find((t) => t.id === tid)?.capacityBase || 2), 0);
    if (cap < r.partySize) return `${cap} couverts pour ${r.partySize} personnes`;
    if (tids.length > 1) {
      const combo = combinations.find((c) => c.tableIds.length === tids.length && c.tableIds.every((x) => tids.includes(x)));
      if (!combo) return "combinaison non répertoriée";
      if (!combo.isUsual) return "combinaison exceptionnelle (hors config habituelle)";
    }
    if (cap - r.partySize >= 4) return `table nettement surdimensionnée (${cap} pour ${r.partySize})`;
    return null;
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-[#a88f78] uppercase font-bold">Réservations du</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg px-2 py-1 text-sm" style={inputStyle} />
        {layouts.length > 1 && (
          <select value={layoutId || ""} onChange={(e) => setLayoutId(e.target.value)} className="rounded-lg px-2 py-1 text-sm" style={inputStyle}>
            {layouts.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        )}
        <span className="text-xs text-[#8a7561]">{restaurant.name}</span>
      </div>

      {/* --- Synthèse de service --- */}
      <div className="flex flex-wrap gap-3 mb-4">
        {services.length === 0 && <span className="text-sm text-[#8a7561]">Aucun service actif ce jour-là.</span>}
        {services.map((s) => {
          const inService = dayReservations.filter((r) => {
            const st = startMinOf(r);
            return st >= s.startMin && st < s.endMin;
          });
          const unassignedInService = (solveResult.unassigned || []).filter((id) => inService.some((r) => r.id === id)).length;
          const syn = serviceSynthesis(
            inService.map((r) => ({ partySize: r.partySize, status: r.status })),
            s,
            unassignedInService
          );
          const isCurrent = currentService?.serviceNumber === s.serviceNumber;
          const isSelected = selectedServiceNum === s.serviceNumber;
          return (
            <div
              key={s.serviceNumber}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedServiceNum((n) => (n === s.serviceNumber ? null : s.serviceNumber))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedServiceNum((n) => (n === s.serviceNumber ? null : s.serviceNumber));
                }
              }}
              className="tap-scale cursor-pointer rounded-xl p-3 min-w-[180px]"
              style={{
                background: isSelected ? "#2a1a22" : "#211712",
                border: isCurrent ? `2px solid ${PINK}` : "1px solid #3a2b1f",
                boxShadow: isSelected ? `0 0 0 2px ${PINK}` : "none",
              }}
            >
              <div className="font-bold text-sm flex items-center gap-2">
                {s.label} {s.autoGenerated && <span className="text-xs" style={{ color: "#e8b23d" }}>· auto</span>}
                {isCurrent && (
                  <span className="text-[10px] font-bold rounded-full px-2 py-0.5" style={{ background: "#3a1e2e", color: PINK }}>
                    ● en cours
                  </span>
                )}
              </div>
              <div className="text-xs text-[#8a7561]">
                {s.startTime}–{s.endTime}
              </div>
              <div className="text-sm mt-1">
                <b>{syn.reserved}</b> couverts réservés{syn.capacity != null ? ` / ${syn.capacity}` : ""}
              </div>
              <div className="text-xs" style={{ color: syn.full ? "#e88a8a" : "#a8e8c8" }}>
                {syn.capacity != null
                  ? syn.full
                    ? "service complet"
                    : `${syn.remaining} couverts encore possibles`
                  : `${syn.count} réservation${syn.count > 1 ? "s" : ""}`}
              </div>
              {syn.unassignedCount > 0 && (
                <div className="text-xs mt-1" style={{ color: "#e88a8a" }}>
                  ⚠️ {syn.unassignedCount} non placée{syn.unassignedCount > 1 ? "s" : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {services.length > 0 && (
        <div className="text-xs text-[#5a4a3a] mb-3">
          Clique un service pour voir son plan et les tables réservées à l'avance.
        </div>
      )}

      {/* --- Plan visuel --- */}
      {layout && placedTables.length > 0 ? (
        <>
          {selectedService && (
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="text-sm font-bold" style={{ color: PINK }}>
                Plan du {selectedService.label} — {selectedServiceInfo.count} table{selectedServiceInfo.count > 1 ? "s" : ""} réservée
                {selectedServiceInfo.count > 1 ? "s" : ""}
              </span>
              <button
                onClick={() => setSelectedServiceNum(null)}
                className="tap-scale text-xs font-bold border-2 border-[#3a2b1f] rounded-full px-3 py-1"
              >
                ← état en direct
              </button>
            </div>
          )}
          <PlanView
            layout={layout}
            placedTables={placedTables}
            statuses={statuses}
            labelById={labelById}
            resById={Object.fromEntries(dayReservations.map((r) => [r.id, r]))}
            highlightIds={selectedService ? selectedServiceInfo.highlightIds : null}
            noteByTable={selectedService ? selectedServiceInfo.noteByTable : null}
          />
        </>
      ) : (
        <div className="text-xs text-[#5a4a3a] mb-3">
          Aucune table placée sur ce plan — configure la position des tables dans l'onglet « Tables ».
        </div>
      )}

      {/* légende */}
      <div className="flex flex-wrap gap-3 mt-3 mb-4">
        {Object.entries(STATUS_STYLE).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5 text-xs text-[#a88f78]">
            <span className="inline-block w-3 h-3 rounded" style={{ background: v.bg, border: `1px solid ${v.border}` }} />
            {v.label}
          </span>
        ))}
      </div>

      {nonPlacedActive.length > 0 && (
        <div className="text-xs text-[#8a7561] mb-4">
          Tables non placées sur le plan :{" "}
          {nonPlacedActive.map((t) => (
            <span key={t.id} className="inline-block rounded-full px-2 py-0.5 mr-1 mb-1" style={{ background: STATUS_STYLE[statuses[t.id]?.status || "libre"]?.bg, border: `1px solid ${STATUS_STYLE[statuses[t.id]?.status || "libre"]?.border}` }}>
              {tableDisplayName(t)}
            </span>
          ))}
        </div>
      )}

      {/* --- Liste des réservations --- */}
      <div className="flex flex-col gap-2">
        {dayReservations.length === 0 && <p className="text-[#8a7561] text-sm">Aucune réservation ce jour-là.</p>}
        {dayReservations.map((r) => {
          const tids = effectiveTables(r.id);
          const isManual = !!manualByRes[r.id];
          const warn = isManual ? warnFor(r, tids) : null;
          const labels = tids.map((tid) => labelById[tid] || "?").join(" + ");
          const st = startMinOf(r);
          const inSelectedService = selectedService && st >= selectedService.startMin && st < selectedService.endMin;
          return (
            <div
              key={r.id}
              className="rounded-xl border bg-[#211712] p-3 flex flex-wrap items-center gap-3 text-sm"
              style={{
                borderColor: inSelectedService ? PINK : "#3a2b1f",
                opacity: selectedService && !inSelectedService ? 0.5 : 1,
              }}
            >
              <span className="font-bold w-14">{hhmm(startMinOf(r))}</span>
              <span className="font-bold min-w-[120px]">{r.customerName || "—"}</span>
              <span className="text-[#a88f78]">{r.partySize} pers.</span>
              <span className="text-xs text-[#8a7561]">{r.customerPhone || ""}</span>
              <span
                className="text-xs rounded-full px-2 py-0.5"
                style={
                  r.status === "seated"
                    ? { background: "#204a3a", color: "#a8e8c8" }
                    : r.status === "completed"
                    ? { background: "#2c1c14", color: "#8a7561" }
                    : { background: "#332a12", color: "#e8b23d" }
                }
              >
                {r.status === "seated" ? "à table" : r.status === "completed" ? "parti" : "confirmée"}
              </span>
              <span className="text-xs">
                {tids.length ? (
                  <>
                    → <b>{labels}</b> {isManual && <span style={{ color: "#e8b23d" }}>(forcé)</span>}
                  </>
                ) : (
                  <span style={{ color: "#e88a8a" }}>⚠ non placée</span>
                )}
              </span>
              {warn && (
                <span className="text-xs" style={{ color: "#e8b23d" }}>
                  ⚠ Config inhabituelle : {warn}
                </span>
              )}

              <div className="flex items-center gap-2 ml-auto">
                {r.status === "confirmed" && (
                  <button
                    onClick={() => updateReservation(r.id, { status: "seated", arrivedAt: new Date().toISOString() }).catch((e) => console.error(e))}
                    className="tap-scale rounded-full px-3 py-1 text-xs font-bold border-2 border-[#204a3a] text-[#a8e8c8]"
                  >
                    Arrivé
                  </button>
                )}
                {r.status === "seated" && (
                  <button
                    onClick={() => updateReservation(r.id, { status: "completed", departedAt: new Date().toISOString() }).catch((e) => console.error(e))}
                    className="tap-scale rounded-full px-3 py-1 text-xs font-bold border-2 border-[#3a2b1f]"
                  >
                    Parti
                  </button>
                )}
                <select
                  value={isManual ? (tids.length > 1 ? `combo:${combinations.find((c) => c.tableIds.length === tids.length && c.tableIds.every((x) => tids.includes(x)))?.id || ""}` : tids[0]) : "auto"}
                  onChange={(e) => forceTables(r.id, e.target.value)}
                  className="rounded-lg px-2 py-1 text-xs"
                  style={inputStyle}
                >
                  <option value="auto">Affectation auto</option>
                  <optgroup label="Table seule">
                    {activeTables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {tableDisplayName(t)}
                      </option>
                    ))}
                  </optgroup>
                  {combinations.length > 0 && (
                    <optgroup label="Combinaison">
                      {combinations.map((c) => (
                        <option key={c.id} value={`combo:${c.id}`}>
                          {c.tableIds.map((tid) => labelById[tid] || "?").join(" + ")} ({c.capacity})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {r.status !== "completed" && (
                  <button
                    onClick={() => updateReservation(r.id, { status: "cancelled" }).catch((e) => console.error(e))}
                    className="tap-scale text-xs text-red-400 font-bold"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
