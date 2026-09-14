"use client";

// Horaires d'ouverture du click & collect, par jour de semaine — distinct des
// "services" de réservation ci-dessous (fenêtres de réservation, volontairement
// plus étroites). Pilote la génération quotidienne des créneaux (voir
// supabase/functions/generate-daily-slots) : un jour sans horaire (case vide)
// n'a simplement aucun créneau généré ce jour-là, plus besoin de les
// supprimer à la main. Les fermetures ponctuelles (congés) restent gérées
// plus bas, dans "Vacances & fermetures" — elles s'appliquent aussi ici.

import { useTakeawayHours, updateTakeawayHours } from "@/lib/data";
import { useRestaurantFilter } from "@/lib/restaurant";

const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };
// 0 = dimanche … 6 = samedi (comme Date.getDay()), affichés dans l'ordre français.
const WEEKDAYS = [
  { i: 1, full: "Lundi" },
  { i: 2, full: "Mardi" },
  { i: 3, full: "Mercredi" },
  { i: 4, full: "Jeudi" },
  { i: 5, full: "Vendredi" },
  { i: 6, full: "Samedi" },
  { i: 0, full: "Dimanche" },
];

function OptionalTimeInput({ value, onCommit }) {
  return (
    <input
      type="time"
      defaultValue={value || ""}
      key={value || ""}
      onBlur={(e) => {
        const v = e.target.value || null;
        if (v !== (value || null)) onCommit(v);
      }}
      className="rounded-lg px-2 py-1 text-sm w-[104px]"
      style={inputStyle}
    />
  );
}

export default function TakeawayHoursAdmin() {
  const restaurantFilter = useRestaurantFilter();
  const { takeawayHours } = useTakeawayHours();
  const byWeekday = Object.fromEntries(takeawayHours.map((h) => [h.weekday, h]));

  function patch(weekday, p) {
    updateTakeawayHours(weekday, p, restaurantFilter).catch((e) => console.error(e));
  }

  return (
    <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4 mb-4">
      <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Horaires d&apos;ouverture — click &amp; collect</div>
      <div className="text-xs text-[#5a4a3a] mb-3 max-w-2xl">
        Heure de début vide = pas de service ce jour-là dans ce créneau (donc pas de créneaux générés). Les fermetures
        exceptionnelles (congés) programmées plus bas dans « Vacances &amp; fermetures » s&apos;appliquent aussi ici.
      </div>
      <div className="flex flex-col gap-2">
        {WEEKDAYS.map(({ i, full }) => {
          const h = byWeekday[i];
          if (!h) return null;
          return (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-24 font-bold">{full}</span>
              <span className="text-xs text-[#a88f78]">Midi</span>
              <OptionalTimeInput value={h.midiOpen} onCommit={(v) => patch(i, { midiOpen: v })} />
              <span className="text-[#8a7561]">→</span>
              <OptionalTimeInput value={h.midiClose} onCommit={(v) => patch(i, { midiClose: v })} />
              <span className="text-xs text-[#a88f78] ml-4">Soir</span>
              <OptionalTimeInput value={h.soirOpen} onCommit={(v) => patch(i, { soirOpen: v })} />
              <span className="text-[#8a7561]">→</span>
              <OptionalTimeInput value={h.soirClose} onCommit={(v) => patch(i, { soirClose: v })} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
