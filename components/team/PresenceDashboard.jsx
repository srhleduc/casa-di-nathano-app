"use client";

import { useMemo } from "react";
import { useStaff, useStaffShifts, useTodayPointageEntries } from "@/lib/data";
import { toMin, toHHMM, weekdayOf } from "@/lib/reservation/services";

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
  const { entries } = useTodayPointageEntries();

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

        // Total travaillé aujourd'hui : somme des paires arrivée→départ,
        // moins les paires pause_debut→pause_fin. Suppose des pointages
        // correctement séquencés (pas de rattrapage sur pointage manquant —
        // voir pointage_corrections, sans écran pour l'instant).
        let workedMin = 0;
        let openStart = null;
        let pauseStart = null;
        for (const e of entriesToday) {
          const m = occurredMin(e.occurredAt);
          if (e.type === "arrivee") openStart = m;
          else if (e.type === "depart" && openStart != null) {
            workedMin += m - openStart;
            openStart = null;
          } else if (e.type === "pause_debut") pauseStart = m;
          else if (e.type === "pause_fin" && pauseStart != null) {
            workedMin -= m - pauseStart;
            pauseStart = null;
          }
        }
        if (openStart != null) workedMin += nowMin() - openStart; // encore en cours

        const plannedMin = shiftsToday.reduce((sum, s) => sum + (toMin(s.endTime) - toMin(s.startTime)), 0);

        return {
          member,
          shiftsToday,
          status,
          arrivalGap,
          departureGap,
          workedMin: Math.max(0, workedMin),
          plannedMin,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.member.fullName.localeCompare(b.member.fullName, "fr"));
  }, [staff, staffShifts, entries]);

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
        Comparaison du jour même uniquement — présence en temps réel, écart
        arrivée/départ vs créneau prévu, heures travaillées vs prévues
        aujourd'hui. Pas de cumul hebdomadaire pour l'instant.
      </div>

      {rows.length === 0 && <p className="text-[#8a7561]">Personne de prévu ni pointé aujourd'hui.</p>}

      <div className="flex flex-col gap-3 max-w-3xl">
        {rows.map(({ member, shiftsToday, status, arrivalGap, departureGap, workedMin, plannedMin }) => {
          const badge = STATUS_BADGE[status];
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
