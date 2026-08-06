-- =====================================================================
-- Casa Di Nathano — schéma Supabase
-- À exécuter une fois dans Supabase → SQL Editor (project SQL, pas psql)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  items jsonb not null default '[]'::jsonb,
  service_type text not null,
  name text not null default 'Client borne',
  slot_allocations jsonb not null default '[]'::jsonb,
  pizza_count integer not null default 0,
  total numeric(10, 2) not null default 0,
  status text not null default 'attente',
  apero_status text,
  scheduled_for date,
  scheduled_time text,
  created_at timestamptz not null default now()
);
create index if not exists orders_created_at_idx on orders (created_at);
create index if not exists orders_status_idx on orders (status);
create index if not exists orders_scheduled_for_idx on orders (scheduled_for);

create table if not exists slots (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  capacity integer not null default 0
);

create table if not exists ruptures (
  item_id text primary key
);

create table if not exists dessert_stock (
  key text primary key,
  qty integer not null default 0
);
insert into dessert_stock (key, qty) values
  ('pannacotta', 0),
  ('tiramisu_cafe', 0),
  ('tiramisu_speculoos', 0),
  ('paris_palerme', 0)
on conflict (key) do nothing;

create table if not exists custom_menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10, 2) not null default 0,
  cat text not null,
  ingredients jsonb,
  photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists table_plan (
  id integer primary key default 1 check (id = 1),
  default_layout jsonb not null default '{"interieur":[],"exterieur":[],"mangedebout":[]}'::jsonb,
  current_layout jsonb not null default '{"interieur":[],"exterieur":[],"mangedebout":[]}'::jsonb
);
insert into table_plan (id) values (1) on conflict (id) do nothing;

create table if not exists team_config (
  id integer primary key default 1 check (id = 1),
  pin text not null default '0505'
);
insert into team_config (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Row Level Security
-- Outil interne (tablettes du restaurant, pas de comptes utilisateurs) :
-- on ouvre lecture + écriture à la clé anon sur toutes les tables.
-- La protection de l'espace équipe reste le PIN côté interface (voir
-- team_config), pas une règle RLS. Ce compromis est documenté dans le
-- README — à ne pas reproduire tel quel pour une app grand public.
-- ---------------------------------------------------------------------

alter table orders enable row level security;
alter table slots enable row level security;
alter table ruptures enable row level security;
alter table dessert_stock enable row level security;
alter table custom_menu_items enable row level security;
alter table table_plan enable row level security;
alter table team_config enable row level security;

create policy "orders_anon_all" on orders for all to anon using (true) with check (true);
create policy "slots_anon_all" on slots for all to anon using (true) with check (true);
create policy "ruptures_anon_all" on ruptures for all to anon using (true) with check (true);
create policy "dessert_stock_anon_all" on dessert_stock for all to anon using (true) with check (true);
create policy "custom_menu_items_anon_all" on custom_menu_items for all to anon using (true) with check (true);
create policy "table_plan_anon_all" on table_plan for all to anon using (true) with check (true);
create policy "team_config_anon_all" on team_config for all to anon using (true) with check (true);

-- ---------------------------------------------------------------------
-- Realtime — publication des changements aux clients abonnés
-- ---------------------------------------------------------------------

alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table slots;
alter publication supabase_realtime add table ruptures;
alter publication supabase_realtime add table dessert_stock;
alter publication supabase_realtime add table custom_menu_items;
alter publication supabase_realtime add table table_plan;

-- ---------------------------------------------------------------------
-- Storage — bucket public pour les photos produits
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('menu-photos', 'menu-photos', true)
on conflict (id) do nothing;

create policy "menu_photos_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'menu-photos');

create policy "menu_photos_anon_write"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'menu-photos');

create policy "menu_photos_anon_update"
  on storage.objects for update
  to anon
  using (bucket_id = 'menu-photos');

create policy "menu_photos_anon_delete"
  on storage.objects for delete
  to anon
  using (bucket_id = 'menu-photos');

-- ---------------------------------------------------------------------
-- Remise à zéro quotidienne (cahier des charges §2.5)
-- Nécessite l'extension pg_cron : Dashboard → Database → Extensions →
-- activer "pg_cron". Ajuste le fuseau horaire du projet (Dashboard →
-- Settings → General) pour que 04:00 corresponde bien à une heure
-- creuse du restaurant.
-- ---------------------------------------------------------------------

create extension if not exists pg_cron;

select cron.schedule(
  'casa-di-nathano-daily-reset',
  '0 4 * * *',
  $$
    delete from ruptures;
    update dessert_stock set qty = 0;
    delete from slots;
    delete from orders
      where date(created_at) < current_date
        and (scheduled_for is null or scheduled_for < current_date);
  $$
);

-- Pour désactiver plus tard : select cron.unschedule('casa-di-nathano-daily-reset');
