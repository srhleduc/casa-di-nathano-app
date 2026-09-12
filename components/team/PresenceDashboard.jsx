"use client";

import { useMemo } from "react";
import {
  useStaff,
  useStaffShifts,
  useTodayPointageEntries,
  useThisWeekPointageEntries,
  useTodayCorrections,
  useThisWeekCorrections,
} from "@/lib/data";
import { toMin, toHHMM, weekdayOf, mondayOf } from "@/lib/reservation/services";
import { computeDailyWorkedMinutes, groupWorkedMinutesByWeek, weeklyPlannedMinutesForStaff, applyCorrections } from "@/lib/business";

const todayISO = () => new Date().toISOString().slice(0, 10);

function nowMin() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function occurredMin(occurredAt) {
  const d = new Date(occurredAt);
  return d.getHours() * 60 + d.getMinutes();
}

// Écart en minutes entre une heure réelle et une heure prévue, affiché en
// badge. null = pas encore de quoi comparer.
function GapBadge({ gap }) {
  if (gap == null) return <span className="text-xs text-[#5a4a3a]">—</span>;
  if (Math.abs(gap) <= 5) {
    return (
      <span className="text-xs font-bold rounded-full px-2 py-0.5" style={{ background: "#204a3a", color: "#a8e8c8" }}>
        à l'heure
      </span>
    );
  }
  const late = gap > 0;
  return (
    <span
      className="text-xs font-bold rounded-full px-2 py-0.5"
      style={late ? { background: "#4a2020", color: "#e8a8a8" } : { background: "#3a2b1f", color: "#c9b8a4" }}
    >
      {late ? "+" : ""}
      {gap} min
    </span>
  );
}

export default function PresenceDashboard() {
  const { staff } = useStaff();
  const { staffShifts } = useStaffShifts();
  const { entries: rawEntries } = useTodayPointageEntries();
  const { entries: rawWeekEntries } = useThisWeekPointageEntries();
  const { corrections } = useTodayCorrections();
  const { corrections: weekCorrections } = useThisWeekCorrections();

  // Pointages bruts jamais modifiés en base — les régularisations ne
  // changent que cette vue "effective" utilisée pour l'affichage/calcul.
  const entries = useMemo(() => applyCorrections(rawEntries, corrections), [rawEntries, corrections]);
  const weekEntries = useMemo(() => applyCorrections(rawWeekEntries, weekCorrections), [rawWeekEntries, weekCorrections]);

  // `asOf = now` : une arrivée encore ouverte (pas de départ pointé) compte
  // jusqu'à maintenant — indispensable ici (vue temps réel), à la différence
  // de l'export paie historique qui ne devine jamais une heure de fin.
  const todayDailyMinutes = useMemo(() => computeDailyWorkedMinutes(entries, new Date()), [entries]);
  const weeklyWorkedByStaff = useMemo(() => {
    const currentMonday = mondayOf(todayISO());
    const byWeek = groupWorkedMinutesByWeek(computeDailyWorkedMinutes(weekEntries, new Date()));
    const byStaff = new Map();
    for (const [key, minutes] of byWeek.entries()) {
      const [staffId, monday] = key.split("|");
      if (monday === currentMonday) byStaff.set(staffId, minutes);
    }
    return byStaff;
  }, [weekEntries]);

  const rows = useMemo(() => {
    const wd = weekdayOf(todayISO());
    const activeStaff = staff.filter((s) => s.active);

    return activeStaff
      .map((member) => {
        const shiftsToday = staffShifts
          .filter((s) => s.staffId === member.id && s.weekday === wd)
          .sort((a, b) => toMin(a.startTime) - toMin(b.startTime));

        const entriesToday = entries
          .filter((e) => e.staffId === member.id)
          .sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));

        if (shiftsToday.length === 0 && entriesToday.length === 0) return null;

        const lastEntry = entriesToday[entriesToday.length - 1] || null;
        const firstArrival = entriesToday.find((e) => e.type === "arrivee") || null;
        const lastDeparture = [...entriesToday].reverse().find((e) => e.type === "depart") || null;

        let status = "absent";
        if (lastEntry) {
          if (lastEntry.type === "arrivee" || lastEntry.type === "pause_fin") status = "present";
          else if (lastEntry.type === "pause_debut") status = "pause";
          else if (lastEntry.type === "depart") status = "parti";
        }
        if (status === "absent" && shiftsToday.length > 0) {
          const dueSince = nowMin() - toMin(shiftsToday[0].startTime);
          status = dueSince > 10 ? "absent_retard" : "pas_encore";
        }

        const arrivalGap =
          firstArrival && shiftsToday.length > 0 ? occurredMin(firstArrival.occurredAt) - toMin(shiftsToday[0].startTime) : null;
        const departureGap =
          lastDeparture && shiftsToday.length > 0
            ? occurredMin(lastDeparture.occurredAt) - toMin(shiftsToday[shiftsToday.length - 1].endTime)
            : null;

        // Total travaillé aujourd'hui — même calcul (computeDailyWorkedMinutes)
        // que le cumul hebdomadaire ci-dessous, pour que les deux convergent
        // toujours (une arrivée encore ouverte compte jusqu'à maintenant).
        const workedMin = todayDailyMinutes.get(`${member.id}|${todayISO()}`) || 0;

        const plannedMin = shiftsToday.reduce((sum, s) => sum + (toMin(s.endTime) - toMin(s.startTime)), 0);

        const weeklyPlannedMin = weeklyPlannedMinutesForStaff(staffShifts, member.id);
        const weeklyWorkedMin = weeklyWorkedByStaff.get(member.id) || 0;

        return {
          member,
          shiftsToday,
          status,
          arrivalGap,
          departureGap,
          workedMin: Math.max(0, workedMin),
          plannedMin,
          weeklyWorkedMin,
          weeklyPlannedMin,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.member.fullName.localeCompare(b.member.fullName, "fr"));
  }, [staff, staffShifts, entries, weeklyWorkedByStaff]);

  const STATUS_BADGE = {
    present: { label: "🟢 présent", bg: "#204a3a", fg: "#a8e8c8" },
    pause: { label: "🟡 en pause", bg: "#4a3a10", fg: "#f0c860" },
    parti: { label: "⚪ parti", bg: "#3a2b1f", fg: "#c9b8a4" },
    absent_retard: { label: "🔴 absent", bg: "#4a2020", fg: "#e8a8a8" },
    pas_encore: { label: "⏳ pas encore arrivé", bg: "#3a2b1f", fg: "#c9b8a4" },
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="text-xs text-[#8a7561] mb-5 max-w-xl">
        Présence en temps réel, écart arrivée/départ vs créneau prévu, heures
        travaillées aujourd'hui et cumul de la semaine en cours (lundi à
        aujourd'hui) vs planning. Le dépassement compare au planning du
        salarié, pas au seuil légal de 35h — à toi de qualifier heures sup ou
        heures complémentaires selon son contrat.
      </div>

      {rows.length === 0 && <p className="text-[#8a7561]">Personne de prévu ni pointé aujourd'hui.</p>}

      <div className="flex flex-col gap-3 max-w-3xl">
        {rows.map(({ member, shiftsToday, status, arrivalGap, departureGap, workedMin, plannedMin, weeklyWorkedMin, weeklyPlannedMin }) => {
          const badge = STATUS_BADGE[status];
          const weeklyOverage = weeklyPlannedMin > 0 ? weeklyWorkedMin - weeklyPlannedMin : null;
          return (
            <div key={member.id} className="rounded-2xl border-2 border-[#3a2b1f] p-4 flex flex-wrap items-center gap-4">
              <div className="min-w-[140px]">
                <div className="display-font text-lg font-bold">{member.fullName}</div>
                <span className="text-xs font-bold rounded-full px-2 py-0.5" style={{ background: badge.bg, color: badge.fg }}>
                  {badge.label}
                </span>
              </div>

              <div className="text-xs text-[#a88f78] min-w-[140px]">
                <div className="uppercase font-bold text-[10px] text-[#8a7561] mb-0.5">Prévu</div>
                {shiftsToday.length > 0
                  ? shiftsToday.map((s) => `${s.startTime}–${s.endTime}`).join(" · ")
                  : "Hors planning"}
              </div>

              <div className="text-xs min-w-[110px]">
                <div className="uppercase font-bold text-[10px] text-[#8a7561] mb-0.5">Écart arrivée</div>
                <GapBadge gap={arrivalGap} />
              </div>

              <div className="text-xs min-w-[110px]">
                <div className="uppercase font-bold text-[10px] text-[#8a7561] mb-0.5">Écart départ</div>
                <GapBadge gap={departureGap} />
              </div>

              <div className="text-xs text-[#a88f78] min-w-[140px]">
                <div className="uppercase font-bold text-[10px] text-[#8a7561] mb-0.5">Heures aujourd'hui</div>
                {toHHMM(workedMin).replace(":", "h")} {plannedMin > 0 ? `/ ${toHHMM(plannedMin).replace(":", "h")} prévu` : ""}
              </div>

              <div className="text-xs text-[#a88f78] min-w-[160px]">
                <div className="uppercase font-bold text-[10px] text-[#8a7561] mb-0.5">Cumul cette semaine</div>
                <div>
                  {toHHMM(weeklyWorkedMin).replace(":", "h")}
                  {weeklyPlannedMin > 0 ? ` / ${toHHMM(weeklyPlannedMin).replace(":", "h")} prévu` : ""}
                </div>
                {weeklyOverage != null && weeklyOverage > 5 && (
                  <span className="text-xs font-bold rounded-full px-2 py-0.5 inline-block mt-1" style={{ background: "#4a2020", color: "#e8a8a8" }}>
                    +{toHHMM(weeklyOverage).replace(":", "h")} au-delà du planning
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
