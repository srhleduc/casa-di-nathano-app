-- =====================================================================
-- MODULE POINTAGE — phase 2 : planning prévisionnel (créneaux hebdo)
-- Additif pur. Base du dashboard écarts planning/réel du jour.
--
-- À exécuter une fois dans Supabase → SQL Editor.
-- =====================================================================

-- Créneaux récurrents par salarié et par jour de semaine (0 = dimanche …
-- 6 = samedi, même convention que weekdayOf() côté app). Plusieurs lignes
-- possibles pour un même salarié/jour (coupure, ex. 11h-15h + 18h-23h le
-- jeudi). Contrairement à pointage_entries, cette table reste librement
-- éditable : un planning n'est pas une preuve légale, juste une prévision.
create table if not exists staff_shifts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff (id),
  restaurant_id text not null references restaurants (id),
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  created_at timestamptz not null default now()
);

create index if not exists staff_shifts_staff
  on staff_shifts (staff_id);

create index if not exists staff_shifts_restaurant_weekday
  on staff_shifts (restaurant_id, weekday);

alter table staff_shifts enable row level security;

drop policy if exists "staff_shifts_select" on staff_shifts;
drop policy if exists "staff_shifts_write" on staff_shifts;
create policy "staff_shifts_select" on staff_shifts for select to authenticated using (restaurant_id = my_restaurant_id() or is_manager());
create policy "staff_shifts_write" on staff_shifts for all to authenticated using (restaurant_id = my_restaurant_id()) with check (restaurant_id = my_restaurant_id());

alter publication supabase_realtime add table staff_shifts;

notify pgrst, 'reload schema';
