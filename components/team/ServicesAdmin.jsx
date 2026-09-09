"use client";

import { useMemo, useState } from "react";
import {
  useServiceTemplates,
  useServiceOverrides,
  useServiceExceptions,
  useReservationSettings,
  useRoomLayouts,
  createServiceTemplate,
  updateServiceTemplate,
  deleteServiceTemplate,
  upsertServiceOverride,
  deleteServiceOverride,
  deleteServiceOverridesForDate,
  createServiceException,
  deleteServiceException,
  updateReservationSettings,
} from "@/lib/data";
import { servicesForDate, servicesOverlap, toMin } from "@/lib/reservation/services";

const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };
const todayISO = () => new Date().toISOString().slice(0, 10);
const pad2 = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const fmtDate = (iso) => {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
};

function TimeInput({ value, onCommit }) {
  return (
    <input
      type="time"
      defaultValue={value}
      key={value}
      onBlur={(e) => e.target.value && e.target.value !== value && onCommit(e.target.value)}
      className="rounded-lg px-2 py-1 text-sm"
      style={inputStyle}
    />
  );
}
// Jours de semaine : 0 = dimanche … 6 = samedi (comme Date.getDay()).
const WEEKDAYS = [
  { i: 1, l: "L", full: "Lundi" },
  { i: 2, l: "M", full: "Mardi" },
  { i: 3, l: "M", full: "Mercredi" },
  { i: 4, l: "J", full: "Jeudi" },
  { i: 5, l: "V", full: "Vendredi" },
  { i: 6, l: "S", full: "Samedi" },
  { i: 0, l: "D", full: "Dimanche" },
];
function WeekdayChips({ value, onChange }) {
  const days = Array.isArray(value) ? value : [0, 1, 2, 3, 4, 5, 6];
  const toggle = (i) =>
    onChange(days.includes(i) ? days.filter((d) => d !== i) : [...days, i].sort((a, b) => a - b));
  return (
    <div className="flex gap-1">
      {WEEKDAYS.map(({ i, l, full }) => {
        const on = days.includes(i);
        return (
          <button
            key={i}
            onClick={() => toggle(i)}
            title={full}
            className="tap-scale w-7 h-7 rounded-full text-xs font-bold border-2"
            style={on ? { borderColor: "#204a3a", background: "#16281c", color: "#a8e8c8" } : { borderColor: "#3a2b1f", color: "#5a4a3a" }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
function NumInput({ value, min = 0, onCommit }) {
  return (
    <input
      type="number"
      min={min}
      defaultValue={value ?? ""}
      key={String(value)}
      onBlur={(e) => {
        const v = e.target.value === "" ? null : Math.max(min, parseInt(e.target.value, 10) || 0);
        if (v !== value) onCommit(v);
      }}
      className="w-16 rounded-lg px-2 py-1 text-sm"
      style={inputStyle}
    />
  );
}

// Un ou plusieurs plans de salle = une ou plusieurs « zones ». À partir de 2,
// on saisit les couverts max par zone (total = somme).
function ZoneCoversInput({ byLayout, layouts, onCommit }) {
  const bl = byLayout || {};
  const total = layouts.reduce((s, l) => s + (Number(bl[l.id]) > 0 ? Number(bl[l.id]) : 0), 0);
  if (layouts.length <= 1) return null; // géré par le champ unique
  return (
    <span className="flex flex-wrap items-center gap-2 text-xs text-[#a88f78]">
      {layouts.map((l) => (
        <label key={l.id} className="flex items-center gap-1">
          {l.name}
          <NumInput value={bl[l.id] ?? ""} min={0} onCommit={(v) => onCommit({ ...bl, [l.id]: v ?? 0 })} />
        </label>
      ))}
      <span className="text-[#8a7561]">total {total}</span>
    </span>
  );
}

export default function ServicesAdmin() {
  const { serviceTemplates } = useServiceTemplates();
  const { serviceOverrides } = useServiceOverrides();
  const { serviceExceptions } = useServiceExceptions();
  const { settings } = useReservationSettings();
  const { layouts } = useRoomLayouts();
  const multiZone = layouts.length > 1;
  const [date, setDate] = useState(todayISO());
  const [calMonth, setCalMonth] = useState(() => todayISO().slice(0, 7)); // "YYYY-MM"
  const [exc, setExc] = useState({ start: "", end: "", target: "all", mode: "off", label: "" });

  const resolved = useMemo(
    () => servicesForDate(date, serviceTemplates, serviceOverrides, serviceExceptions),
    [date, serviceTemplates, serviceOverrides, serviceExceptions]
  );
  const overlap = servicesOverlap(resolved);
  const dateOverrides = serviceOverrides.filter((o) => o.date === date);

  // Affichage chronologique : le numéro de service reste l'identité, mais on
  // liste les services par heure de début (un service ajouté plus tard peut
  // commencer plus tôt).
  const sortedTemplates = useMemo(
    () =>
      [...serviceTemplates].sort(
        (a, b) => (toMin(a.startTime) ?? 0) - (toMin(b.startTime) ?? 0) || a.serviceNumber - b.serviceNumber
      ),
    [serviceTemplates]
  );

  function addTemplate() {
    const nextNum = (serviceTemplates.reduce((m, t) => Math.max(m, t.serviceNumber), 0) || 0) + 1;
    const last = sortedTemplates[sortedTemplates.length - 1];
    const start = last?.endTime || "19:00";
    createServiceTemplate({
      serviceNumber: nextNum,
      label: `${nextNum}${nextNum === 1 ? "er" : "e"} service`,
      startTime: start,
      endTime: "22:30",
      maxCovers: 40,
      activeByDefault: nextNum === 1,
    }).catch((e) => console.error(e));
  }

  // Bascule/édite un service pour la date choisie → écrit un override.
  // L'upsert remplace la ligne : on renvoie toujours max_covers ET
  // max_covers_by_layout existants pour ne pas les écraser.
  function overrideService(s, patch) {
    upsertServiceOverride({
      date,
      serviceNumber: s.serviceNumber,
      startTime: patch.startTime ?? s.startTime,
      endTime: patch.endTime ?? s.endTime,
      maxCovers: patch.maxCovers !== undefined ? patch.maxCovers : s.maxCovers,
      maxCoversByLayout: patch.maxCoversByLayout !== undefined ? patch.maxCoversByLayout : s.maxCoversByLayout || {},
      isActive: patch.isActive !== undefined ? patch.isActive : true,
      autoGenerated: s.autoGenerated || false,
    }).catch((e) => console.error(e));
  }
  // Réactiver pour cette date un service désactivé par défaut.
  function activateTemplateForDate(tpl) {
    upsertServiceOverride({
      date,
      serviceNumber: tpl.serviceNumber,
      startTime: tpl.startTime,
      endTime: tpl.endTime,
      maxCovers: tpl.maxCovers,
      maxCoversByLayout: tpl.maxCoversByLayout || {},
      isActive: true,
    }).catch((e) => console.error(e));
  }

  const inactiveTemplatesForDate = sortedTemplates.filter(
    (t) => !resolved.some((r) => r.serviceNumber === t.serviceNumber) && !dateOverrides.some((o) => o.serviceNumber === t.serviceNumber)
  );

  // --- Vacances & fermetures (planning annuel) ---
  const sortedExceptions = useMemo(
    () => [...serviceExceptions].sort((a, b) => a.dateStart.localeCompare(b.dateStart) || a.dateEnd.localeCompare(b.dateEnd)),
    [serviceExceptions]
  );
  function excTargetLabel(e) {
    if (e.serviceNumber == null) return "Toute la pizzeria";
    const t = serviceTemplates.find((x) => x.serviceNumber === e.serviceNumber);
    return t?.label || `Service ${e.serviceNumber}`;
  }
  function addException() {
    const start = exc.start;
    const end = exc.end || exc.start;
    if (!start || end < start) return;
    createServiceException({
      dateStart: start,
      dateEnd: end,
      serviceNumber: exc.target === "all" ? null : Number(exc.target),
      mode: exc.mode,
      label: exc.label.trim() || null,
    })
      .then(() => setExc({ start: "", end: "", target: "all", mode: "off", label: "" }))
      .catch((e) => console.error(e));
  }
  // état d'un jour pour le mini-calendrier (fermé / partiel / complet)
  function dayState(iso) {
    const nominal = servicesForDate(iso, serviceTemplates, [], []).length;
    const actual = servicesForDate(iso, serviceTemplates, serviceOverrides, serviceExceptions).length;
    const touched =
      serviceOverrides.some((o) => o.date === iso) ||
      serviceExceptions.some((e) => e.dateStart <= iso && iso <= e.dateEnd);
    if (actual === 0) return { bg: "#3a1414", fg: "#e8a8a8", touched, actual, nominal };
    if (actual < nominal) return { bg: "#3a2f12", fg: "#e8c87d", touched, actual, nominal };
    return { bg: "#16281c", fg: "#a8e8c8", touched, actual, nominal };
  }
  const [calY, calM] = calMonth.split("-").map(Number);
  const monthLabel = new Date(calY, calM - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const daysInMonth = new Date(calY, calM, 0).getDate();
  const leadBlanks = (new Date(calY, calM - 1, 1).getDay() + 6) % 7; // lundi en tête
  function shiftMonth(delta) {
    const d = new Date(calY, calM - 1 + delta, 1);
    setCalMonth(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="text-xs text-[#8a7561] mb-5 max-w-2xl">
        Les <b>services par défaut</b> (1er, 2e…) sont actifs les <b>jours de semaine cochés</b> (ex. 2e service le
        week-end seulement). Les <b>ajustements par date</b> activent / désactivent ou décalent un service pour une
        date précise (priment sur les jours cochés). Un service <b>auto-généré</b> apparaît quand une réservation
        tombe hors des services actifs.
      </div>

      {/* --- Services par défaut --- */}
      <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4 mb-4">
        <div className="text-xs text-[#a88f78] uppercase font-bold mb-3">Services par défaut</div>
        <div className="flex flex-col gap-2">
          {sortedTemplates.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs text-[#8a7561] w-5">#{t.serviceNumber}</span>
              <input
                defaultValue={t.label || ""}
                key={t.label}
                onBlur={(e) => e.target.value !== (t.label || "") && updateServiceTemplate(t.id, { label: e.target.value }).catch((err) => console.error(err))}
                placeholder="Nom"
                className="rounded-lg px-2 py-1 text-sm w-40"
                style={inputStyle}
              />
              <TimeInput value={t.startTime} onCommit={(v) => updateServiceTemplate(t.id, { startTime: v }).catch((e) => console.error(e))} />
              <span className="text-[#8a7561]">→</span>
              <TimeInput value={t.endTime} onCommit={(v) => updateServiceTemplate(t.id, { endTime: v }).catch((e) => console.error(e))} />
              {multiZone ? (
                <ZoneCoversInput
                  byLayout={t.maxCoversByLayout}
                  layouts={layouts}
                  onCommit={(bl) => updateServiceTemplate(t.id, { maxCoversByLayout: bl }).catch((e) => console.error(e))}
                />
              ) : (
                <label className="flex items-center gap-1 text-xs text-[#a88f78]">
                  couv. max
                  <NumInput value={t.maxCovers} min={1} onCommit={(v) => updateServiceTemplate(t.id, { maxCovers: v }).catch((e) => console.error(e))} />
                </label>
              )}
              <WeekdayChips
                value={t.activeWeekdays}
                onChange={(w) => updateServiceTemplate(t.id, { activeWeekdays: w }).catch((e) => console.error(e))}
              />
              <button onClick={() => deleteServiceTemplate(t.id).catch((e) => console.error(e))} className="tap-scale text-xs text-red-400 font-bold">
                ✕
              </button>
            </div>
          ))}
          {serviceTemplates.length === 0 && <span className="text-xs text-[#5a4a3a]">Aucun service défini.</span>}
        </div>
        <button onClick={addTemplate} className="tap-scale mt-3 rounded-full px-3 py-1.5 text-xs font-bold border-2 border-[#3a2b1f]">
          + Ajouter un service
        </button>
      </div>

      {/* --- Réglages --- */}
      <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4 mb-4">
        <div className="text-xs text-[#a88f78] uppercase font-bold mb-3">Réglages réservation</div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2 text-xs text-[#a88f78]">
            Délai minimum avant réservation (min)
            <NumInput value={settings.bookingLeadMinutes} min={0} onCommit={(v) => updateReservationSettings({ bookingLeadMinutes: v ?? 30 }).catch((e) => console.error(e))} />
          </label>
          <label className="flex items-center gap-2 text-xs text-[#a88f78]">
            Marge de sécurité (min)
            <NumInput value={settings.safetyMarginMinutes} min={0} onCommit={(v) => updateReservationSettings({ safetyMarginMinutes: v ?? 0 }).catch((e) => console.error(e))} />
          </label>
          <label className="flex items-center gap-2 text-xs text-[#a88f78]">
            Pas des créneaux (min)
            <NumInput value={settings.slotGranularityMinutes} min={5} onCommit={(v) => updateReservationSettings({ slotGranularityMinutes: v ?? 15 }).catch((e) => console.error(e))} />
          </label>
          <button
            onClick={() => updateReservationSettings({ onlineBookingEnabled: !settings.onlineBookingEnabled }).catch((e) => console.error(e))}
            className="tap-scale rounded-full px-3 py-1.5 text-xs font-bold border-2"
            style={settings.onlineBookingEnabled ? { borderColor: "#204a3a", color: "#a8e8c8" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
          >
            {settings.onlineBookingEnabled ? "✓ Réservation en ligne activée" : "Réservation en ligne désactivée"}
          </button>
        </div>

        <div className="mt-4 pt-3 border-t border-[#3a2b1f]">
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#a88f78]">
            Plage des services auto-générés — de
            <TimeInput value={settings.earliestServiceTime} onCommit={(v) => updateReservationSettings({ earliestServiceTime: v }).catch((e) => console.error(e))} />
            à
            <TimeInput value={settings.latestServiceTime} onCommit={(v) => updateReservationSettings({ latestServiceTime: v }).catch((e) => console.error(e))} />
          </div>
          <div className="text-xs text-[#5a4a3a] mt-1 max-w-2xl">
            Bornes utilisées uniquement quand une réservation tombe hors de tous les services actifs et qu'un service
            est créé automatiquement pour l'accueillir. N'a aucun effet sur les créneaux proposés en ligne, qui
            dépendent seulement des services actifs du jour et du pas des créneaux.
          </div>
        </div>
      </div>

      {/* --- Ajustements par date --- */}
      <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs text-[#a88f78] uppercase font-bold">Ajustements pour le</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg px-2 py-1 text-sm" style={inputStyle} />
          {dateOverrides.length > 0 && (
            <button onClick={() => deleteServiceOverridesForDate(date).catch((e) => console.error(e))} className="tap-scale text-xs text-red-400 font-bold">
              Réinitialiser cette date
            </button>
          )}
        </div>

        {overlap && (
          <div className="text-xs mb-2" style={{ color: "#e8b23d" }}>
            ⚠️ Des services se chevauchent pour cette date.
          </div>
        )}

        <div className="flex flex-col gap-2">
          {resolved.map((s) => (
            <div key={s.serviceNumber} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-bold">{s.label}</span>
              {s.autoGenerated && (
                <span className="text-xs rounded-full px-2 py-0.5" style={{ background: "#4a3a10", color: "#e8b23d" }}>
                  auto
                </span>
              )}
              {s.hasOverride && !s.autoGenerated && <span className="text-xs text-[#8a7561]">(ajusté)</span>}
              <TimeInput value={s.startTime} onCommit={(v) => overrideService(s, { startTime: v })} />
              <span className="text-[#8a7561]">→</span>
              <TimeInput value={s.endTime} onCommit={(v) => overrideService(s, { endTime: v })} />
              {multiZone ? (
                <ZoneCoversInput
                  byLayout={s.maxCoversByLayout}
                  layouts={layouts}
                  onCommit={(bl) => overrideService(s, { maxCoversByLayout: bl })}
                />
              ) : (
                <label className="flex items-center gap-1 text-xs text-[#a88f78]">
                  couv. max
                  <NumInput value={s.maxCovers} min={1} onCommit={(v) => overrideService(s, { maxCovers: v })} />
                </label>
              )}
              <button
                onClick={() => overrideService(s, { isActive: false })}
                className="tap-scale rounded-full px-3 py-1 text-xs font-bold border-2 border-[#4a2020] text-[#e8a8a8]"
              >
                Désactiver ce jour
              </button>
            </div>
          ))}
          {resolved.length === 0 && <span className="text-xs text-[#5a4a3a]">Aucun service actif ce jour-là.</span>}
        </div>

        {inactiveTemplatesForDate.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {inactiveTemplatesForDate.map((t) => (
              <button
                key={t.id}
                onClick={() => activateTemplateForDate(t)}
                className="tap-scale rounded-full px-3 py-1.5 text-xs font-bold border-2 border-[#204a3a] text-[#a8e8c8]"
              >
                + Activer « {t.label || `Service ${t.serviceNumber}`} » ce jour
              </button>
            ))}
          </div>
        )}

        {/* réactiver un service désactivé ponctuellement (override isActive=false) */}
        {dateOverrides.filter((o) => !o.isActive).map((o) => {
          const tpl = serviceTemplates.find((t) => t.serviceNumber === o.serviceNumber);
          return (
            <button
              key={o.id}
              onClick={() => upsertServiceOverride({ date, serviceNumber: o.serviceNumber, startTime: o.startTime, endTime: o.endTime, maxCovers: o.maxCovers, maxCoversByLayout: o.maxCoversByLayout || {}, isActive: true }).catch((e) => console.error(e))}
              className="tap-scale mt-2 rounded-full px-3 py-1.5 text-xs font-bold border-2 border-[#204a3a] text-[#a8e8c8]"
            >
              Réactiver « {tpl?.label || `Service ${o.serviceNumber}`} » ce jour
            </button>
          );
        })}
      </div>

      {/* --- Vacances & fermetures (planning annuel) --- */}
      <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4 mt-4">
        <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Vacances & fermetures</div>
        <div className="text-xs text-[#5a4a3a] mb-3 max-w-2xl">
          Programme à l'avance sur une plage de dates : fermeture de toute la pizzeria (congés) ou coupure d'un
          service précis. « Ouvrir exceptionnellement » ré-ouvre un jour au milieu d'une plage de congés.
        </div>

        {/* mini-calendrier */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => shiftMonth(-1)} className="tap-scale px-2 py-1 rounded border-2 border-[#3a2b1f] text-xs font-bold">‹</button>
            <span className="text-sm font-bold capitalize">{monthLabel}</span>
            <button onClick={() => shiftMonth(1)} className="tap-scale px-2 py-1 rounded border-2 border-[#3a2b1f] text-xs font-bold">›</button>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(7, 34px)", gap: 3 }}>
            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
              <div key={i} className="text-center text-xs text-[#5a4a3a] font-bold">{d}</div>
            ))}
            {Array.from({ length: leadBlanks }).map((_, i) => <div key={`b${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dnum = i + 1;
              const iso = ymd(calY, calM, dnum);
              const st = dayState(iso);
              const sel = iso === date;
              return (
                <button
                  key={iso}
                  onClick={() => { setDate(iso); setExc((x) => ({ ...x, start: iso, end: iso })); }}
                  title={`${fmtDate(iso)} — ${st.actual}/${st.nominal} service(s)`}
                  className="relative rounded text-xs font-bold"
                  style={{ height: 34, background: st.bg, color: st.fg, border: sel ? "2px solid #fff5ea" : "1px solid #2a1f16" }}
                >
                  {dnum}
                  {st.touched && <span className="absolute top-0.5 right-1" style={{ fontSize: 8 }}>•</span>}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-[#8a7561]">
            <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded" style={{ background: "#16281c", border: "1px solid #204a3a" }} /> complet</span>
            <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded" style={{ background: "#3a2f12", border: "1px solid #4a3a10" }} /> partiel</span>
            <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded" style={{ background: "#3a1414", border: "1px solid #4a2020" }} /> fermé</span>
            <span>• = ajustement / exception ce jour</span>
          </div>
        </div>

        {/* liste des exceptions */}
        <div className="flex flex-col gap-2 mb-3">
          {sortedExceptions.map((e) => {
            const past = e.dateEnd < todayISO();
            return (
              <div key={e.id} className="flex flex-wrap items-center gap-2 text-sm" style={{ opacity: past ? 0.45 : 1 }}>
                <span className="font-bold">
                  {e.dateStart === e.dateEnd ? fmtDate(e.dateStart) : `du ${fmtDate(e.dateStart)} au ${fmtDate(e.dateEnd)}`}
                </span>
                <span className="text-xs text-[#a88f78]">· {excTargetLabel(e)} ·</span>
                <span
                  className="text-xs font-bold rounded-full px-2 py-0.5"
                  style={e.mode === "off" ? { background: "#4a2020", color: "#e8a8a8" } : { background: "#204a3a", color: "#a8e8c8" }}
                >
                  {e.mode === "off" ? "Fermé" : "Ouvert except."}
                </span>
                {e.label && <span className="text-xs text-[#8a7561]">{e.label}</span>}
                <button onClick={() => deleteServiceException(e.id).catch((err) => console.error(err))} className="tap-scale text-xs text-red-400 font-bold ml-auto">
                  ✕
                </button>
              </div>
            );
          })}
          {sortedExceptions.length === 0 && <span className="text-xs text-[#5a4a3a]">Aucune fermeture programmée.</span>}
        </div>

        {/* ajout d'une exception */}
        <div className="rounded-lg border border-[#3a2b1f] p-3 flex flex-wrap items-end gap-2 text-xs">
          <label className="flex flex-col gap-1 text-[#a88f78]">
            Du
            <input type="date" value={exc.start} onChange={(e) => setExc((x) => ({ ...x, start: e.target.value }))} className="rounded-lg px-2 py-1" style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1 text-[#a88f78]">
            Au
            <input type="date" value={exc.end} min={exc.start || undefined} onChange={(e) => setExc((x) => ({ ...x, end: e.target.value }))} className="rounded-lg px-2 py-1" style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1 text-[#a88f78]">
            Cible
            <select value={exc.target} onChange={(e) => setExc((x) => ({ ...x, target: e.target.value }))} className="rounded-lg px-2 py-1" style={inputStyle}>
              <option value="all">Toute la pizzeria</option>
              {sortedTemplates.map((t) => (
                <option key={t.id} value={t.serviceNumber}>
                  {t.label || `Service ${t.serviceNumber}`}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-1">
            <button
              onClick={() => setExc((x) => ({ ...x, mode: "off" }))}
              className="tap-scale rounded-full px-3 py-1.5 font-bold border-2"
              style={exc.mode === "off" ? { borderColor: "#C0392B", background: "#2c1c14", color: "#fff5ea" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
            >
              Fermer
            </button>
            <button
              onClick={() => setExc((x) => ({ ...x, mode: "on" }))}
              className="tap-scale rounded-full px-3 py-1.5 font-bold border-2"
              style={exc.mode === "on" ? { borderColor: "#204a3a", background: "#16281c", color: "#a8e8c8" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
            >
              Ouvrir except.
            </button>
          </div>
          <input
            value={exc.label}
            onChange={(e) => setExc((x) => ({ ...x, label: e.target.value }))}
            placeholder="Libellé (ex. Congés d'été)"
            className="rounded-lg px-2 py-1 flex-1 min-w-[140px]"
            style={inputStyle}
          />
          <button
            onClick={addException}
            disabled={!exc.start || (exc.end && exc.end < exc.start)}
            className="tap-scale rounded-full px-4 py-2 font-bold disabled:opacity-40"
            style={{ background: "#C0392B", color: "#fff5ea" }}
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}
