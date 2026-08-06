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
  prep_served boolean not null default false,
  is_test boolean not null default false,
  oven_done_at timestamptz,
  finition_done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists orders_created_at_idx on orders (created_at);
create index if not exists orders_status_idx on orders (status);
create index if not exists orders_scheduled_for_idx on orders (scheduled_for);
-- Migrations pour une base déjà créée avant l'ajout de ces colonnes (sans effet si elles existent déjà) :
alter table orders add column if not exists prep_served boolean not null default false;
alter table orders add column if not exists is_test boolean not null default false;
alter table orders add column if not exists oven_done_at timestamptz;
alter table orders add column if not exists finition_done_at timestamptz;

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

-- Table historique, remplacée par menu_items ci-dessous (tout le menu, y compris les
-- produits de base, est maintenant éditable depuis Logistique → Menu). Conservée telle
-- quelle en base (non utilisée par l'app) pour ne rien supprimer sans le demander.
create table if not exists custom_menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10, 2) not null default 0,
  cat text not null,
  ingredients jsonb,
  photo_url text,
  created_at timestamptz not null default now()
);

-- Le menu complet (anciennement codé en dur dans lib/menu.js) : pizzas, antipasti,
-- salades, suppléments, "sans", boissons, bières, vins, cocktails, desserts. Les ids des
-- produits d'origine sont des slugs stables (ex. "pizza-margherita-di-napoli") pour rester
-- compatibles avec les références déjà stockées dans `ruptures.item_id`.
create table if not exists menu_items (
  id text primary key,
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

-- Décompte de pâtons du soir (optionnel — total = 0 signifie "pas de limite
-- configurée", les pizzas restent illimitées tant que l'équipe n'a rien saisi).
create table if not exists pizza_stock (
  id integer primary key default 1 check (id = 1),
  total integer not null default 0,
  safety_margin integer not null default 0
);
insert into pizza_stock (id) values (1) on conflict (id) do nothing;

-- Mode test équipe : quand activé, les commandes créées côté équipe sont marquées
-- is_test (voir orders) — exclues des totaux caisse et des stocks, supprimées quand
-- le mode test est désactivé.
create table if not exists test_mode (
  id integer primary key default 1 check (id = 1),
  enabled boolean not null default false
);
insert into test_mode (id) values (1) on conflict (id) do nothing;

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
alter table menu_items enable row level security;
alter table table_plan enable row level security;
alter table team_config enable row level security;
alter table pizza_stock enable row level security;
alter table test_mode enable row level security;

create policy "orders_anon_all" on orders for all to anon using (true) with check (true);
create policy "slots_anon_all" on slots for all to anon using (true) with check (true);
create policy "ruptures_anon_all" on ruptures for all to anon using (true) with check (true);
create policy "dessert_stock_anon_all" on dessert_stock for all to anon using (true) with check (true);
create policy "custom_menu_items_anon_all" on custom_menu_items for all to anon using (true) with check (true);
create policy "menu_items_anon_all" on menu_items for all to anon using (true) with check (true);
create policy "table_plan_anon_all" on table_plan for all to anon using (true) with check (true);
create policy "team_config_anon_all" on team_config for all to anon using (true) with check (true);
create policy "pizza_stock_anon_all" on pizza_stock for all to anon using (true) with check (true);
create policy "test_mode_anon_all" on test_mode for all to anon using (true) with check (true);

-- ---------------------------------------------------------------------
-- Realtime — publication des changements aux clients abonnés
-- ---------------------------------------------------------------------

alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table slots;
alter publication supabase_realtime add table ruptures;
alter publication supabase_realtime add table dessert_stock;
alter publication supabase_realtime add table custom_menu_items;
alter publication supabase_realtime add table menu_items;
alter publication supabase_realtime add table table_plan;
alter publication supabase_realtime add table pizza_stock;
alter publication supabase_realtime add table test_mode;

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
-- Note : ce job ne filtre pas par restaurant, ce qui est volontaire — une fois
-- restaurant_id ajouté (voir plus bas), il continue de remettre à zéro chaque
-- restaurant indépendamment sans qu'on ait besoin d'y toucher.

-- =====================================================================
-- MULTI-RESTAURANT — PHASE 1 (structure, additif, sans risque)
-- Casa Di Nathano (Riec) + Casa Di Luigi (Quimperlé) + espace Direction.
-- Cette phase n'ajoute que des tables et des colonnes NULLABLES : rien
-- n'est cassé pour l'app actuelle (qui ne les utilise pas encore). Le
-- passage en clé primaire restaurant_id, la contrainte NOT NULL et le
-- passage des RLS à `to authenticated` se feront ensemble à la Phase 2,
-- en même temps que la mise à jour du code de l'app — pas avant.
-- =====================================================================

create table if not exists restaurants (
  id text primary key,
  name text not null,
  city text not null,
  accent_color text
);
insert into restaurants (id, name, city) values
  ('riec', 'Casa Di Nathano', 'Riec-sur-Belon'),
  ('quimperle', 'Casa Di Luigi', 'Quimperlé')
on conflict (id) do nothing;

alter table restaurants enable row level security;
create policy "restaurants_authenticated_read" on restaurants for select to authenticated using (true);

-- Associe un compte Supabase Auth fixe (un par restaurant) à son restaurant.
create table if not exists restaurant_accounts (
  auth_uid uuid primary key references auth.users (id) on delete cascade,
  restaurant_id text not null references restaurants (id)
);
alter table restaurant_accounts enable row level security;
create policy "restaurant_accounts_self" on restaurant_accounts for select to authenticated using (auth_uid = auth.uid());

-- Comptes Direction (un par gérant), voient les deux restaurants en lecture.
create table if not exists managers (
  auth_uid uuid primary key references auth.users (id) on delete cascade,
  name text
);
alter table managers enable row level security;
create policy "managers_self" on managers for select to authenticated using (auth_uid = auth.uid());

-- Colonnes restaurant_id — nullable pour l'instant (bascule non cassante).
alter table orders add column if not exists restaurant_id text references restaurants (id);
alter table slots add column if not exists restaurant_id text references restaurants (id);
alter table ruptures add column if not exists restaurant_id text references restaurants (id);
alter table dessert_stock add column if not exists restaurant_id text references restaurants (id);
alter table table_plan add column if not exists restaurant_id text references restaurants (id);
alter table team_config add column if not exists restaurant_id text references restaurants (id);
alter table pizza_stock add column if not exists restaurant_id text references restaurants (id);
alter table test_mode add column if not exists restaurant_id text references restaurants (id);

-- Backfill : tout ce qui existe aujourd'hui appartient à Riec.
update orders set restaurant_id = 'riec' where restaurant_id is null;
update slots set restaurant_id = 'riec' where restaurant_id is null;
update ruptures set restaurant_id = 'riec' where restaurant_id is null;
update dessert_stock set restaurant_id = 'riec' where restaurant_id is null;
update table_plan set restaurant_id = 'riec' where restaurant_id is null;
update team_config set restaurant_id = 'riec' where restaurant_id is null;
update pizza_stock set restaurant_id = 'riec' where restaurant_id is null;
update test_mode set restaurant_id = 'riec' where restaurant_id is null;

-- =====================================================================
-- MULTI-RESTAURANT — PHASE 2a (additif, sans coupure)
-- Ajoute les policies `to authenticated` À CÔTÉ des anciennes policies
-- anon (pas de drop ici) : l'ancien code (anon) continue de fonctionner
-- exactement comme avant, le nouveau code (authenticated) fonctionne déjà
-- dès qu'il est déployé — aucune fenêtre de coupure entre les deux.
-- =====================================================================

-- Petites fonctions utilitaires pour ne pas répéter la sous-requête dans
-- chaque policy. security definer + search_path figé (recommandation Supabase).
create or replace function my_restaurant_id()
returns text
language sql stable security definer set search_path = public
as $$
  select restaurant_id from restaurant_accounts where auth_uid = auth.uid()
$$;

create or replace function is_manager()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from managers where auth_uid = auth.uid())
$$;

-- Tables propres à un restaurant : lecture pour son propre restaurant OU la
-- Direction (managers) ; écriture réservée à son propre restaurant.
do $$
declare
  t text;
begin
  foreach t in array array['orders', 'slots', 'ruptures', 'dessert_stock', 'table_plan', 'team_config', 'pizza_stock', 'test_mode']
  loop
    execute format('create policy "%s_select" on %I for select to authenticated using (restaurant_id = my_restaurant_id() or is_manager())', t, t);
    execute format('create policy "%s_write" on %I for all to authenticated using (restaurant_id = my_restaurant_id()) with check (restaurant_id = my_restaurant_id())', t, t);
  end loop;
end $$;

-- menu_items : catalogue partagé. Lecture et écriture ouvertes à tout compte
-- authentifié pour l'instant (le temps que l'espace Direction existe) — sera
-- resserré à la Phase 4 (écriture réservée aux managers).
create policy "menu_items_authenticated_all" on menu_items for all to authenticated using (true) with check (true);

-- Stockage des photos produits : upload aussi autorisé aux comptes authentifiés
-- (la lecture publique via l'URL du bucket n'est pas affectée par RLS).
create policy "menu_photos_authenticated_write" on storage.objects for insert to authenticated with check (bucket_id = 'menu-photos');
create policy "menu_photos_authenticated_update" on storage.objects for update to authenticated using (bucket_id = 'menu-photos');
create policy "menu_photos_authenticated_delete" on storage.objects for delete to authenticated using (bucket_id = 'menu-photos');

-- =====================================================================
-- MULTI-RESTAURANT — PHASE 2b (nettoyage — à exécuter seulement une fois
-- que le nouveau code de Riec est déployé et vérifié fonctionnel avec les
-- policies `authenticated` ci-dessus). Retire l'accès anonyme et verrouille
-- restaurant_id. Ne PAS exécuter avant d'avoir confirmé que Riec fonctionne.
-- =====================================================================

drop policy if exists "orders_anon_all" on orders;
drop policy if exists "slots_anon_all" on slots;
drop policy if exists "ruptures_anon_all" on ruptures;
drop policy if exists "dessert_stock_anon_all" on dessert_stock;
drop policy if exists "menu_items_anon_all" on menu_items;
drop policy if exists "table_plan_anon_all" on table_plan;
drop policy if exists "team_config_anon_all" on team_config;
drop policy if exists "pizza_stock_anon_all" on pizza_stock;
drop policy if exists "test_mode_anon_all" on test_mode;
drop policy if exists "menu_photos_anon_write" on storage.objects;
drop policy if exists "menu_photos_anon_update" on storage.objects;
drop policy if exists "menu_photos_anon_delete" on storage.objects;

alter table orders alter column restaurant_id set not null;
alter table slots alter column restaurant_id set not null;
alter table ruptures alter column restaurant_id set not null;
alter table dessert_stock alter column restaurant_id set not null;
alter table table_plan alter column restaurant_id set not null;
alter table team_config alter column restaurant_id set not null;
alter table pizza_stock alter column restaurant_id set not null;
alter table test_mode alter column restaurant_id set not null;

-- =====================================================================
-- MULTI-RESTAURANT — PHASE 3 (Quimperlé)
-- À exécuter une fois le nouveau code (restaurant_id au lieu de id=1,
-- onConflict composite pour slots) déployé et vérifié sur Riec.
-- =====================================================================

-- Retire l'ancienne contrainte "un seul label pour tout le monde" (retrouvée
-- dynamiquement — son nom auto-généré n'est pas garanti d'un environnement à l'autre).
do $$
declare
  c text;
begin
  select conname into c from pg_constraint
    where conrelid = 'slots'::regclass and contype = 'u' and array_length(conkey, 1) = 1;
  if c is not null then
    execute format('alter table slots drop constraint %I', c);
  end if;
end $$;

-- table_plan / team_config / pizza_stock / test_mode : la clé primaire
-- devient restaurant_id (une ligne par restaurant) au lieu de id=1 fixe.
alter table table_plan drop constraint if exists table_plan_pkey;
alter table table_plan drop column if exists id;
alter table table_plan add primary key (restaurant_id);
insert into table_plan (restaurant_id) values ('quimperle') on conflict do nothing;

alter table team_config drop constraint if exists team_config_pkey;
alter table team_config drop column if exists id;
alter table team_config add primary key (restaurant_id);
insert into team_config (restaurant_id, pin) values ('quimperle', '0505') on conflict do nothing;

alter table pizza_stock drop constraint if exists pizza_stock_pkey;
alter table pizza_stock drop column if exists id;
alter table pizza_stock add primary key (restaurant_id);
insert into pizza_stock (restaurant_id) values ('quimperle') on conflict do nothing;

alter table test_mode drop constraint if exists test_mode_pkey;
alter table test_mode drop column if exists id;
alter table test_mode add primary key (restaurant_id);
insert into test_mode (restaurant_id) values ('quimperle') on conflict do nothing;

-- =====================================================================
-- MULTI-RESTAURANT — PHASE 4 (espace Direction)
-- Resserre l'édition du menu (catalogue partagé) aux seuls comptes managers ;
-- la lecture reste ouverte à tout compte authentifié (équipe + Direction).
-- =====================================================================

drop policy if exists "menu_items_authenticated_all" on menu_items;

create policy "menu_items_select" on menu_items for select to authenticated using (true);
create policy "menu_items_write" on menu_items for insert to authenticated with check (is_manager());
create policy "menu_items_update" on menu_items for update to authenticated using (is_manager()) with check (is_manager());
create policy "menu_items_delete" on menu_items for delete to authenticated using (is_manager());

-- =====================================================================
-- NOTIFICATIONS DIRECTION — alerte "embouteillage four"
-- Notifie les comptes managers par notification push (navigateur/téléphone)
-- dès que 3 commandes ou plus attendent simultanément au four depuis plus
-- de 15 minutes, par restaurant. Déclenchée par une tâche planifiée
-- (pg_cron, toutes les minutes) qui appelle une Supabase Edge Function —
-- voir supabase/functions/oven-alert-check.
-- =====================================================================

-- Abonnements push : un manager peut avoir plusieurs appareils (téléphone,
-- ordinateur...), chacun une ligne. RLS : chacun ne voit/gère que les siens ;
-- l'edge function utilise la clé service_role et n'est donc pas concernée.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  auth_uid uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;
create policy "push_subscriptions_own" on push_subscriptions
  for all to authenticated
  using (auth_uid = auth.uid())
  with check (auth_uid = auth.uid());

-- Mémorise, par restaurant, si l'alerte est actuellement "active" — évite de
-- notifier à nouveau chaque minute tant que l'embouteillage persiste ; se
-- réarme dès que le nombre repasse sous 3.
create table if not exists oven_alert_state (
  restaurant_id text primary key references restaurants (id),
  active boolean not null default false,
  triggered_at timestamptz
);
insert into oven_alert_state (restaurant_id)
  select id from restaurants
  on conflict do nothing;
alter table oven_alert_state enable row level security;
create policy "oven_alert_state_managers" on oven_alert_state
  for select to authenticated
  using (is_manager());

-- Déclenche la vérification toutes les minutes. La fonction est déployée
-- avec --no-verify-jwt (appel interne uniquement), donc pas de clé à stocker
-- dans le job. Adapter l'URL si le projet Supabase change un jour.
create extension if not exists pg_net;

select cron.schedule(
  'oven-alert-check',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://tvuqyrkomuwlapevgekv.functions.supabase.co/oven-alert-check'
    );
  $$
);

-- Pour désactiver plus tard : select cron.unschedule('oven-alert-check');

-- =====================================================================
-- COÛT DE REVIENT & CONSOMMATION (espace Direction)
-- =====================================================================

-- Catalogue d'ingrédients (partagé entre les deux restaurants, comme
-- menu_items) — édition réservée aux managers, lecture ouverte à tous.
create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null, -- 'g' | 'kg' | 'ml' | 'l' | 'piece'
  cost_per_unit numeric(10, 4) not null default 0,
  created_at timestamptz not null default now()
);
alter table ingredients enable row level security;
create policy "ingredients_select" on ingredients for select to authenticated using (true);
create policy "ingredients_write" on ingredients for insert to authenticated with check (is_manager());
create policy "ingredients_update" on ingredients for update to authenticated using (is_manager()) with check (is_manager());
create policy "ingredients_delete" on ingredients for delete to authenticated using (is_manager());

-- Recette : quantité d'un ingrédient pour une pizza donnée (menu_items.id).
create table if not exists pizza_ingredients (
  id uuid primary key default gen_random_uuid(),
  menu_item_id text not null references menu_items (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id) on delete cascade,
  quantity numeric(10, 3) not null default 0,
  unique (menu_item_id, ingredient_id)
);
alter table pizza_ingredients enable row level security;
create policy "pizza_ingredients_select" on pizza_ingredients for select to authenticated using (true);
create policy "pizza_ingredients_write" on pizza_ingredients for insert to authenticated with check (is_manager());
create policy "pizza_ingredients_update" on pizza_ingredients for update to authenticated using (is_manager()) with check (is_manager());
create policy "pizza_ingredients_delete" on pizza_ingredients for delete to authenticated using (is_manager());

-- Ventes journalières archivées — alimentée chaque nuit par la remise à
-- zéro (voir plus bas), AVANT que les commandes de la veille ne soient
-- supprimées. La table orders ne conserve que le jour courant ; c'est cette
-- table qui permet à la page Consommation de regarder en arrière sur une
-- période passée.
create table if not exists daily_sales (
  restaurant_id text not null references restaurants (id),
  date date not null,
  menu_item_id text not null,
  qty integer not null default 0,
  primary key (restaurant_id, date, menu_item_id)
);
alter table daily_sales enable row level security;
create policy "daily_sales_select" on daily_sales
  for select to authenticated
  using (restaurant_id = my_restaurant_id() or is_manager());

-- Quantités réellement utilisées, saisies par la Direction pour une
-- période donnée — sert à calculer l'écart avec la quantité théorique.
create table if not exists consumption_actuals (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null references restaurants (id),
  ingredient_id uuid not null references ingredients (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  qty_actual numeric(10, 3) not null default 0,
  created_at timestamptz not null default now(),
  unique (restaurant_id, ingredient_id, period_start, period_end)
);
alter table consumption_actuals enable row level security;
create policy "consumption_actuals_managers" on consumption_actuals
  for all to authenticated
  using (is_manager())
  with check (is_manager());

-- Met à jour la remise à zéro nocturne (même nom de job → remplace la
-- précédente définition) pour archiver les ventes de pizzas de la veille
-- dans daily_sales avant de supprimer les commandes.
select cron.schedule(
  'casa-di-nathano-daily-reset',
  '0 4 * * *',
  $$
    insert into daily_sales (restaurant_id, date, menu_item_id, qty)
    select o.restaurant_id, date(o.created_at), item->>'id', sum(coalesce((item->>'qty')::int, 1))
    from orders o, jsonb_array_elements(o.items) item
    where date(o.created_at) < current_date
      and (o.scheduled_for is null or o.scheduled_for < current_date)
      and o.is_test = false
      and item->>'cat' = 'pizza'
    group by o.restaurant_id, date(o.created_at), item->>'id'
    on conflict (restaurant_id, date, menu_item_id)
      do update set qty = daily_sales.qty + excluded.qty;

    delete from ruptures;
    update dessert_stock set qty = 0;
    delete from slots;
    delete from orders
      where date(created_at) < current_date
        and (scheduled_for is null or scheduled_for < current_date);
  $$
);
