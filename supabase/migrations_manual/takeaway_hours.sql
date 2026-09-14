-- Horaires d'ouverture du click & collect, par établissement et par jour de
-- semaine — distinct des "services" de réservation (service_templates), qui
-- représentent des fenêtres de RÉSERVATION de table volontairement plus
-- étroites (ex. Riec : 21h15-21h30 pour le "2e service soir"), pas les
-- horaires réels d'ouverture pour la vente à emporter. Les fermetures
-- globales (congés, service_exceptions avec service_number null = "toute la
-- pizzeria") restent en revanche communes aux deux usages, voir
-- generate-daily-slots.
--
-- Deux fenêtres par jour (midi/soir, comme team_config.midi_capacity /
-- soir_capacity déjà existants) — une fenêtre à NULL = pas de service ce
-- jour-là dans ce créneau. Seedé avec les horaires actuels codés en dur
-- (12h-15h / 18h-23h50, tous les jours, pour les deux établissements) pour
-- ne rien changer au comportement existant tant que le patron n'a pas
-- ajusté un jour précis.

create table if not exists takeaway_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null references restaurants (id),
  weekday int not null check (weekday between 0 and 6), -- 0=dimanche…6=samedi (Date.getDay())
  midi_open time,
  midi_close time,
  soir_open time,
  soir_close time,
  unique (restaurant_id, weekday)
);
alter table takeaway_hours enable row level security;
create policy "takeaway_hours_select" on takeaway_hours for select to authenticated using (restaurant_id = my_restaurant_id() or is_manager());
create policy "takeaway_hours_write" on takeaway_hours for all to authenticated
  using (restaurant_id = my_restaurant_id() or is_manager())
  with check (restaurant_id = my_restaurant_id() or is_manager());
alter publication supabase_realtime add table takeaway_hours;

insert into takeaway_hours (restaurant_id, weekday, midi_open, midi_close, soir_open, soir_close)
select r.id, wd, '12:00', '15:00', '18:00', '23:50'
from restaurants r, generate_series(0, 6) wd
on conflict (restaurant_id, weekday) do nothing;

notify pgrst, 'reload schema';
