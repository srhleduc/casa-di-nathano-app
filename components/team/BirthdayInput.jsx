"use client";

import { useState } from "react";

// Sélecteur de date en 3 listes (jour / mois / année), utilisé pour les
// anniversaires (passé) et les dates d'expiration (futur : `future`, `min`).
// Remplace <input type="date"> : sur certaines tablettes de la pizzeria, le
// calendrier natif ne s'ouvre pas (le clavier s'affiche à la place). Les <select>
// ouvrent toujours le sélecteur natif de l'appareil.
// value / onChange : chaîne "YYYY-MM-DD", ou "" tant que la date est incomplète.
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function parse(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  return m ? { y: m[1], m: String(Number(m[2])), d: String(Number(m[3])) } : { y: "", m: "", d: "" };
}

export default function BirthdayInput({ value, onChange, className = "", style, future = false, min }) {
  const [parts, setParts] = useState(() => parse(value));

  function update(next) {
    setParts(next);
    const { y, m, d } = next;
    if (!y || !m || !d) {
      onChange("");
      return;
    }
    // Ramène le jour à la fin du mois si besoin (ex. 31 -> 30 en avril).
    const maxDay = new Date(Number(y), Number(m), 0).getDate();
    const day = Math.min(Number(d), maxDay);
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onChange(min && iso < min ? "" : iso); // date antérieure au minimum -> invalide
  }

  const thisYear = new Date().getFullYear();
  const years = [];
  if (future) for (let y = thisYear; y <= thisYear + 5; y++) years.push(y);
  else for (let y = thisYear; y >= thisYear - 100; y--) years.push(y);

  const cls = `rounded-lg px-2 py-2 ${className}`;
  return (
    <div className="flex gap-2">
      <select aria-label="Jour" value={parts.d} onChange={(e) => update({ ...parts, d: e.target.value })} className={cls} style={style}>
        <option value="">Jour</option>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={String(d)}>{d}</option>
        ))}
      </select>
      <select aria-label="Mois" value={parts.m} onChange={(e) => update({ ...parts, m: e.target.value })} className={`${cls} flex-1`} style={style}>
        <option value="">Mois</option>
        {MOIS.map((label, i) => (
          <option key={label} value={String(i + 1)}>{label}</option>
        ))}
      </select>
      <select aria-label="Année" value={parts.y} onChange={(e) => update({ ...parts, y: e.target.value })} className={cls} style={style}>
        <option value="">Année</option>
        {years.map((y) => (
          <option key={y} value={String(y)}>{y}</option>
        ))}
      </select>
    </div>
  );
}
