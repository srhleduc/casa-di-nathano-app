"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchStaffForRestaurant, fetchPointageEntriesForRange } from "@/lib/data";
import { computeDailyWorkedMinutes } from "@/lib/business";
import { toHHMM } from "@/lib/reservation/services";
import { useRestaurantsList } from "@/lib/restaurant";

const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// "YYYY-MM" -> ["YYYY-MM-01", "YYYY-MM-<dernier jour>"]
function monthBounds(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return [`${monthStr}-01`, `${monthStr}-${String(lastDay).padStart(2, "0")}`];
}

function hhmm(min) {
  if (!min) return "00:00";
  return toHHMM(Math.round(min));
}

function csvEscape(v) {
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function PayrollExportAdmin() {
  const restaurants = useRestaurantsList();
  const [restaurantId, setRestaurantId] = useState(null);
  const [month, setMonth] = useState(currentMonthStr());
  const [staff, setStaff] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!restaurantId && restaurants.length > 0) setRestaurantId(restaurants[0].id);
  }, [restaurants, restaurantId]);

  const [start, end] = monthBounds(month);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchStaffForRestaurant(restaurantId), fetchPointageEntriesForRange(restaurantId, start, end)])
      .then(([staffRows, entryRows]) => {
        if (cancelled) return;
        setStaff(staffRows);
        setEntries(entryRows);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [restaurantId, start, end]);

  const dailyMinutes = useMemo(() => computeDailyWorkedMinutes(entries), [entries]);

  // Une ligne par salarié ayant au moins un jour travaillé sur le mois,
  // triée par nom, avec le détail jour par jour et le total du mois.
  const rows = useMemo(() => {
    const byStaff = new Map();
    for (const [key, minutes] of dailyMinutes.entries()) {
      const [staffId, date] = key.split("|");
      if (!byStaff.has(staffId)) byStaff.set(staffId, []);
      byStaff.get(staffId).push({ date, minutes });
    }
    return staff
      .map((member) => {
        const days = (byStaff.get(member.id) || []).sort((a, b) => a.date.localeCompare(b.date));
        const totalMinutes = days.reduce((s, d) => s + d.minutes, 0);
        return { member, days, totalMinutes };
      })
      .filter((r) => r.days.length > 0)
      .sort((a, b) => a.member.fullName.localeCompare(b.member.fullName, "fr"));
  }, [staff, dailyMinutes]);

  function downloadCsv() {
    const restaurant = restaurants.find((r) => r.id === restaurantId);
    const lines = [["Salarié", "Contrat", "Date", "Heures travaillées"].join(";")];
    for (const { member, days } of rows) {
      for (const d of days) {
        lines.push([member.fullName, member.contractType, d.date, hhmm(d.minutes)].map(csvEscape).join(";"));
      }
    }
    lines.push("");
    lines.push(["Salarié", "Total du mois"].join(";"));
    for (const { member, totalMinutes } of rows) {
      lines.push([member.fullName, hhmm(totalMinutes)].map(csvEscape).join(";"));
    }

    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pointage-${(restaurant?.name || restaurantId).replace(/[^a-z0-9]+/gi, "-")}-${month}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Restaurant</div>
          <div className="flex gap-2">
            {restaurants.map((r) => (
              <button
                key={r.id}
                onClick={() => setRestaurantId(r.id)}
                className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2"
                style={restaurantId === r.id ? { borderColor: "#C0392B", background: "#2c1c14" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Mois</div>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
        </div>
        <button
          onClick={downloadCsv}
          disabled={rows.length === 0}
          className="tap-scale rounded-full px-6 py-3 font-bold disabled:opacity-40"
          style={{ background: "#C0392B", color: "#fff5ea" }}
        >
          ⬇️ Télécharger le CSV
        </button>
      </div>

      <div className="text-xs text-[#8a7561] mb-4">
        Heures travaillées = pointages arrivée/départ, moins les pauses, jour par jour. Un pointage manquant (oubli de
        départ) est compté jusqu'au dernier pointage connu, pas au-delà — vérifie les journées incomplètes avant
        transmission à la paie.
      </div>

      {loading && <p className="text-[#8a7561]">Chargement…</p>}

      {!loading && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#a88f78] uppercase">
                <th className="py-2 pr-4">Salarié</th>
                <th className="py-2 pr-4">Contrat</th>
                <th className="py-2 pr-4">Jours travaillés</th>
                <th className="py-2 pr-4">Total du mois</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ member, days, totalMinutes }) => (
                <tr key={member.id} className="border-t border-[#3a2b1f] align-top">
                  <td className="py-2 pr-4 font-bold">{member.fullName}</td>
                  <td className="py-2 pr-4 uppercase text-xs text-[#a88f78]">{member.contractType}</td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
                      {days.map((d) => (
                        <span key={d.date}>
                          {d.date.slice(8, 10)}/{d.date.slice(5, 7)} · {hhmm(d.minutes)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 pr-4 font-mono font-bold">{hhmm(totalMinutes)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-[#8a7561]">
                    Aucun pointage enregistré pour ce restaurant sur ce mois.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
