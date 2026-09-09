-- Planning annuel des fermetures / ouvertures exceptionnelles des services.
-- Congés de la pizzeria (plage de dates, toute la maison), ou coupure d'un
-- service précis sur une période, avec ré-ouverture ponctuelle possible.
--
-- Plage [date_start, date_end] inclusive (jour unique = mêmes valeurs).
-- service_number NULL = toutes les prestations. mode 'off' = ferme,
-- 'on' = ré-ouverture exceptionnelle.
-- Priorité de résolution (dans servicesForDate) :
--   service_overrides (date exacte) > exception la plus étroite
--   (service précis > global, off > on) > jour de semaine du template.
--
-- À coller dans Supabase → SQL Editor. Une instruction par ligne.

create table if not exists service_exceptions (id uuid primary key default gen_random_uuid(), restaurant_id text not null references restaurants (id), date_start date not null, date_end date not null, service_number int, mode text not null default 'off' check (mode in ('on', 'off')), label text, created_at timestamptz not null default now(), check (date_end >= date_start));
alter table service_exceptions enable row level security;
drop policy if exists "service_exceptions_select" on service_exceptions;
drop policy if exists "service_exceptions_write" on service_exceptions;
create policy "service_exceptions_select" on service_exceptions for select to authenticated using (restaurant_id = my_restaurant_id() or is_manager());
create policy "service_exceptions_write" on service_exceptions for all to authenticated using (restaurant_id = my_restaurant_id()) with check (restaurant_id = my_restaurant_id());
alter publication supabase_realtime add table service_exceptions;

notify pgrst, 'reload schema';
