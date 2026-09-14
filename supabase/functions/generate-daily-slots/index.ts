// Génère les créneaux click & collect du jour, par établissement, à partir
// des horaires d'ouverture (takeaway_hours, un réglage par jour de semaine —
// voir components/team/TakeawayHoursAdmin.jsx) et des fermetures globales
// programmées (service_exceptions avec service_number NULL = "toute la
// pizzeria" — congés, jours fériés…). Un jour sans horaire (ou fermé par
// exception) n'a simplement aucun créneau généré ce jour-là.
//
// Remplace l'ancien bloc figé (12h-15h / 18h-minuit tous les jours pour tout
// le monde) qui vivait dans le job pg_cron "casa-di-nathano-daily-reset"
// (voir supabase/schema.sql). Déclenchée chaque nuit par pg_cron via pg_net,
// juste après ce job (voir
// supabase/migrations_manual/generate_daily_slots_cron.sql).
//
// Déployée avec `supabase functions deploy generate-daily-slots --no-verify-jwt`.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const SLOT_STEP_MINUTES = 10;

function toMin(t: string | null): number | null {
  if (t == null) return null;
  const [h, m] = String(t).split(":");
  return Number(h) * 60 + Number(m || 0);
}
function toHHMM(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00`).getDay();
}
function exceptionSpanDays(e: { dateStart: string; dateEnd: string }): number {
  return (new Date(e.dateEnd).getTime() - new Date(e.dateStart).getTime()) / 86400000;
}

type Exception = { dateStart: string; dateEnd: string; mode: "on" | "off" };

// Fermeture globale ("toute la pizzeria") active pour cette date — priorité à
// l'exception la plus étroite (span le plus court), 'off' gagnant sur 'on' en
// cas d'égalité. Même règle de résolution que lib/reservation/services.js
// (servicesForDate), restreinte aux exceptions globales (service_number null)
// puisque takeaway_hours n'a pas de notion de "service" numéroté.
function isClosedByException(dateStr: string, exceptions: Exception[]): boolean {
  const covering = exceptions.filter((e) => e.dateStart <= dateStr && dateStr <= e.dateEnd);
  const sorted = covering.sort(
    (a, b) => exceptionSpanDays(a) - exceptionSpanDays(b) || (a.mode === "off" ? -1 : 1) - (b.mode === "off" ? -1 : 1)
  );
  return sorted[0]?.mode === "off";
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  const today = new Date().toISOString().slice(0, 10);
  const wd = weekdayOf(today);

  const [{ data: restaurants, error: rErr }, hoursRes, excRes, cfgRes] = await Promise.all([
    supabase.from("restaurants").select("id"),
    supabase.from("takeaway_hours").select("restaurant_id, weekday, midi_open, midi_close, soir_open, soir_close").eq("weekday", wd),
    supabase.from("service_exceptions").select("restaurant_id, date_start, date_end, mode").is("service_number", null),
    supabase.from("team_config").select("restaurant_id, midi_capacity, soir_capacity"),
  ]);
  if (rErr) return new Response(rErr.message, { status: 500 });

  const results = [];
  for (const restaurant of restaurants || []) {
    const rid = restaurant.id;
    const hours = (hoursRes.data || []).find((h) => h.restaurant_id === rid);
    const exceptions: Exception[] = (excRes.data || [])
      .filter((e) => e.restaurant_id === rid)
      .map((e) => ({ dateStart: e.date_start, dateEnd: e.date_end, mode: e.mode }));
    const cfg = (cfgRes.data || []).find((c) => c.restaurant_id === rid) as { midi_capacity?: number; soir_capacity?: number } | undefined;

    const { error: delErr } = await supabase.from("slots").delete().eq("restaurant_id", rid);
    if (delErr) {
      results.push({ restaurant: rid, error: delErr.message });
      continue;
    }

    const byLabel = new Map<string, number>();
    if (hours && !isClosedByException(today, exceptions)) {
      const windows: { open: string | null; close: string | null; cap: number }[] = [
        { open: hours.midi_open, close: hours.midi_close, cap: cfg?.midi_capacity ?? 0 },
        { open: hours.soir_open, close: hours.soir_close, cap: cfg?.soir_capacity ?? 0 },
      ];
      for (const w of windows) {
        const startMin = toMin(w.open);
        const endMin = toMin(w.close);
        if (startMin == null || endMin == null) continue;
        for (let t = startMin; t <= endMin; t += SLOT_STEP_MINUTES) byLabel.set(toHHMM(t), w.cap);
      }
    }

    if (byLabel.size > 0) {
      const rows = [...byLabel.entries()].map(([label, capacity]) => ({ restaurant_id: rid, label, capacity }));
      const { error: insErr } = await supabase.from("slots").insert(rows);
      if (insErr) {
        results.push({ restaurant: rid, error: insErr.message });
        continue;
      }
    }
    results.push({ restaurant: rid, slotsGenerated: byLabel.size });
  }

  return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
});
