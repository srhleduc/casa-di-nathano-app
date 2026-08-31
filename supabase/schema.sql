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

-- Ajoutées après coup (Coût de revient / Consommation / Commande
-- fournisseurs) — oubliées lors de leur création, ce qui faisait que les
-- ajouts fonctionnaient bien en base mais n'apparaissaient jamais à l'écran
-- sans recharger la page.
alter publication supabase_realtime add table ingredients;
alter publication supabase_realtime add table pizza_ingredients;
alter publication supabase_realtime add table suppliers;
alter publication supabase_realtime add table daily_sales;
alter publication supabase_realtime add table consumption_actuals;
alter publication supabase_realtime add table team_config;

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
-- précédente définition) pour archiver les ventes de la veille (tous
-- produits, plus seulement les pizzas — coût de revient/consommation
-- couvrent désormais toutes les catégories) dans daily_sales avant de
-- supprimer les commandes.
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

-- Saisie d'un achat (quantité + prix payé) au lieu d'un coût par unité déjà
-- calculé — colonnes purement pour pré-remplir le formulaire d'édition,
-- cost_per_unit reste la valeur utilisée par tous les calculs.
alter table ingredients add column if not exists purchase_qty numeric(10, 3);
alter table ingredients add column if not exists purchase_unit text;
alter table ingredients add column if not exists purchase_price numeric(10, 2);

-- =====================================================================
-- COMMANDE FOURNISSEURS (espace Direction)
-- Fournisseurs partagés entre les deux restaurants (comme le catalogue
-- d'ingrédients) ; chaque ingrédient peut être rattaché à un seul fournisseur.
-- =====================================================================

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
alter table suppliers enable row level security;
create policy "suppliers_select" on suppliers for select to authenticated using (true);
create policy "suppliers_write" on suppliers for insert to authenticated with check (is_manager());
create policy "suppliers_update" on suppliers for update to authenticated using (is_manager()) with check (is_manager());
create policy "suppliers_delete" on suppliers for delete to authenticated using (is_manager());

alter table ingredients add column if not exists supplier_id uuid references suppliers (id) on delete set null;

-- L'ingrédient générique "Pâte (base commune)" (créé lors de l'import Excel
-- initial, cf. plus haut) a été décomposé en Farine + Farines graines + Eau
-- sur chaque pizza qui l'utilisait — mêmes coûts totaux, juste plus lisible.
-- (Exécuté une fois manuellement, rien à rejouer ici — mentionné pour la trace.)

-- Import des coûts vins + bière Moretti depuis « cout de revient 25.xlsx »
-- (Feuil3) : 14 vins (ingrédient = la bouteille en ml, recette bouteille =
-- 750ml, recette verre = 120ml — volume de service supposé 12cl) + Birra
-- Moretti (coût connu pour 25cl, réutilisé pour la 50cl). Le vin "Monte
-- Pietroso" et les 9 autres bières du menu n'ont pas de coût dans le
-- fichier — à compléter manuellement, comme tous les antipasti/salades/
-- desserts/boissons/cocktails (aucune donnée source disponible pour eux).
-- (Exécuté une fois manuellement, rien à rejouer ici — mentionné pour la trace.)

-- =====================================================================
-- CRÉNEAUX AUTOMATIQUES (midi + soir) — ouverts chaque nuit sans action de
-- l'équipe. Les capacités par défaut (dernière valeur utilisée avec le
-- bouton "Générer" de Logistique → Créneaux du jour) sont mémorisées par
-- restaurant, pour que la génération automatique sache quoi utiliser.
-- =====================================================================

alter table team_config add column if not exists midi_capacity integer not null default 6;
alter table team_config add column if not exists soir_capacity integer not null default 6;

-- Met à jour la remise à zéro nocturne (même nom de job → remplace la
-- précédente définition) pour régénérer, juste après le nettoyage, les
-- créneaux midi (12h-15h) et soir (18h-minuit) de chaque restaurant avec
-- leur capacité par défaut — plus besoin de cliquer "Générer" chaque jour,
-- et les créneaux du soir sont donc déjà ouverts pendant tout le service
-- de midi pour les clients qui réservent à l'avance.
select cron.schedule(
  'casa-di-nathano-daily-reset',
  '0 4 * * *',
  'insert into daily_sales (restaurant_id, date, menu_item_id, qty) select o.restaurant_id, date(o.created_at), item->>''id'', sum(coalesce((item->>''qty'')::int, 1)) from orders o, jsonb_array_elements(o.items) item where date(o.created_at) < current_date and (o.scheduled_for is null or o.scheduled_for < current_date) and o.is_test = false group by o.restaurant_id, date(o.created_at), item->>''id'' on conflict (restaurant_id, date, menu_item_id) do update set qty = daily_sales.qty + excluded.qty;
   delete from ruptures;
   update dessert_stock set qty = 0;
   update team_config set takeaway_order_counter = 0;
   delete from slots;
   delete from orders where date(created_at) < current_date and (scheduled_for is null or scheduled_for < current_date);
   insert into slots (restaurant_id, label, capacity)
     select tc.restaurant_id, to_char(t, ''HH24:MI''), tc.midi_capacity
     from team_config tc, generate_series(timestamp ''2000-01-01 12:00'', timestamp ''2000-01-01 15:00'', interval ''10 minutes'') t
     union all
     select tc.restaurant_id, to_char(t, ''HH24:MI''), tc.soir_capacity
     from team_config tc, generate_series(timestamp ''2000-01-01 18:00'', timestamp ''2000-01-01 23:50'', interval ''10 minutes'') t
     union all
     select tc.restaurant_id, ''24:00'', tc.soir_capacity
     from team_config tc
     on conflict (restaurant_id, label) do update set capacity = excluded.capacity;'
);

-- Produits disponibles uniquement sur place (glaces, Paris Palerme) —
-- masqués de la borne/équipe quand "À emporter" est sélectionné.
alter table menu_items add column if not exists dine_in_only boolean not null default false;
update menu_items set dine_in_only = true
  where id in ('dessert-gelato-dello-chef', 'dessert-glace-1-boule', 'dessert-glace-2-boules', 'dessert-glace-3-boules', 'dessert-paris-palerme');

-- Formules du midi (panuzzo) — 3 sandwichs, catégorie partagée entre les
-- deux restaurants comme le reste du menu.
insert into menu_items (id, name, price, cat, ingredients) values
  ('panuzzo-poisson', 'Panuzzo Poisson', 9.70, 'panuzzo', '["Saumon","Stracciatella","Roquette","Huile citronnée"]'::jsonb),
  ('panuzzo-viande', 'Panuzzo Viande', 9.70, 'panuzzo', '["Mortadelle","Stracciatella","Roquette","Copeaux de parmesan"]'::jsonb),
  ('panuzzo-vegetarien', 'Panuzzo Végétarien', 9.70, 'panuzzo', '["Tomates séchées","Stracciatella","Roquette","Copeaux de parmesan","Pickles oignons rouges","Poivrons gouttes"]'::jsonb)
on conflict (id) do nothing;

-- Clarifie deux suppléments ambigus (base de la pizza, pas juste un ajout
-- d'ingrédient) — mis en avant spécifiquement pour la 4 Formaggi côté code.
update menu_items set name = 'Supplément base tomate' where id = 'supplement-supp-tomate';
update menu_items set name = 'Supplément base crème' where id = 'supplement-supp-creme';

-- Activer/désactiver les types de service depuis Logistique — par restaurant.
alter table team_config add column if not exists service_dine_in_enabled boolean not null default true;
alter table team_config add column if not exists service_takeaway_enabled boolean not null default true;
alter table team_config add column if not exists service_reserved_enabled boolean not null default true;

-- Nouvelle catégorie "Café/Thés" (cat = 'cafe' côté lib/menu.js).
insert into menu_items (id, name, price, cat) values
  ('cafe-allonge', 'Café allongé', 2.40, 'cafe'),
  ('cafe-expresso', 'Expresso', 2.40, 'cafe'),
  ('cafe-double-expresso', 'Double expresso', 2.40, 'cafe'),
  ('the', 'Thé', 2.40, 'cafe')
on conflict (id) do nothing;

-- =====================================================================
-- LIEN DE COMMANDE À EMPORTER PAR QR CODE (/commande)
-- =====================================================================

-- Numéro affiché quand le click and collect est suspendu.
alter table restaurants add column if not exists phone text;
update restaurants set phone = '06 33 67 62 13' where id = 'riec';
update restaurants set phone = '06 30 05 93 58' where id = 'quimperle';

-- Bouton d'arrêt d'urgence côté Caisse — par restaurant.
alter table team_config add column if not exists takeaway_link_suspended boolean not null default false;

-- =====================================================================
-- NUMÉRO DE COMMANDE À EMPORTER (1 à 99, boucle, remis à zéro chaque nuit)
-- =====================================================================

alter table team_config add column if not exists takeaway_order_counter integer not null default 0;
alter table orders add column if not exists takeaway_number integer;

-- Incrémentation atomique (évite toute course si deux commandes à emporter
-- arrivent au même moment) — restreinte au restaurant du compte appelant
-- via my_restaurant_id(), jamais un restaurant_id fourni par le client.
create or replace function next_takeaway_number()
returns integer
language sql
security definer
set search_path = public
as $$
  update team_config
  set takeaway_order_counter = (takeaway_order_counter % 99) + 1
  where restaurant_id = my_restaurant_id()
  returning takeaway_order_counter;
$$;

grant execute on function next_takeaway_number() to authenticated;

-- Marqueurs de dismissal propres à chaque écran équipe — n'affectent pas le
-- statut global de la commande (status), juste sa visibilité sur cet écran
-- précis : "delivered" pour retirer une commande prête de l'écran Service
-- une fois apportée à table (indépendamment du paiement, qui peut arriver
-- bien plus tard), "drinks_served" pour la retirer de l'écran Boissons une
-- fois les boissons servies.
alter table orders add column if not exists delivered boolean not null default false;
alter table orders add column if not exists drinks_served boolean not null default false;

-- Cidre, ajouté à la catégorie "Bières" (cat = 'biere').
insert into menu_items (id, name, price, cat) values
  ('cidre', 'Cidre', 5.00, 'biere')
on conflict (id) do nothing;

-- La clé primaire de dessert_stock était `key` seul, alors que restaurant_id
-- a été ajouté après coup sans resserrer la contrainte : deux restaurants
-- utilisant le même nom de dessert (ex: 'pannacotta') partagent en réalité
-- la même ligne et s'écrasent silencieusement l'un l'autre à chaque
-- enregistrement. Bascule vers une clé composite (restaurant_id, key), comme
-- déjà fait pour table_plan/team_config/pizza_stock/test_mode.
alter table dessert_stock drop constraint if exists dessert_stock_pkey;
alter table dessert_stock add primary key (restaurant_id, key);

-- Complète les lignes manquantes : chaque dessert déjà suivi (par n'importe
-- quel restaurant) doit exister pour tous les restaurants, à 0 par défaut —
-- sans quoi un restaurant qui n'a jamais encore rempli une case n'aurait
-- simplement aucune ligne pour ce dessert. N'écrase aucune valeur existante.
insert into dessert_stock (restaurant_id, key, qty)
  select r.id, k.key, 0
  from restaurants r
  cross join (select distinct key from dessert_stock) k
on conflict (restaurant_id, key) do nothing;

-- Panna Cotta et Tiramisu sont préparés dans des contenants différents (donc
-- en quantités différentes) selon "sur place" ou "à emporter" : le stock du
-- jour se comptait jusqu'ici sur une seule case en pratique réservée au
-- format à emporter. Ajoute les 3 cases "sur place" manquantes (une par
-- restaurant) ; le Paris Palerme reste une case unique, déjà réservé au sur
-- place puisqu'il n'est jamais proposé à emporter (dine_in_only).
insert into dessert_stock (restaurant_id, key, qty)
  select r.id, k, 0
  from restaurants r
  cross join (values ('pannacotta_sur_place'), ('tiramisu_cafe_sur_place'), ('tiramisu_speculoos_sur_place')) as t(k)
on conflict (restaurant_id, key) do nothing;

-- Note libre sur une commande (distincte des notes par article, ex. parfum de
-- glace) — saisie par les serveuses à la prise de commande, sur place comme
-- à emporter, et affichée en évidence sur les écrans équipe.
alter table orders add column if not exists note text;

-- Vrai quand une serveuse a forcé un créneau déjà plein théoriquement (avec
-- l'accord du pizzaiolo, qui sous-estime parfois sa capacité en début de
-- service) — sert uniquement de trace visible côté équipe (badge sur les
-- tickets), n'affecte pas le décompte de capacité en lui-même.
alter table orders add column if not exists slot_forced boolean not null default false;

-- Met à jour la remise à zéro nocturne (même nom de job → remplace la
-- précédente définition) pour repasser chaque jour le stock de pâtons en
-- illimité (total = 0, voir remainingPizzaStock côté lib/business.js) — les
-- pizzaiolos oublient parfois de le remettre à illimité après un service où
-- ils avaient serré la limite, ce qui contraignait le service suivant sans
-- raison.
select cron.schedule(
  'casa-di-nathano-daily-reset',
  '0 4 * * *',
  'insert into daily_sales (restaurant_id, date, menu_item_id, qty) select o.restaurant_id, date(o.created_at), item->>''id'', sum(coalesce((item->>''qty'')::int, 1)) from orders o, jsonb_array_elements(o.items) item where date(o.created_at) < current_date and (o.scheduled_for is null or o.scheduled_for < current_date) and o.is_test = false group by o.restaurant_id, date(o.created_at), item->>''id'' on conflict (restaurant_id, date, menu_item_id) do update set qty = daily_sales.qty + excluded.qty;
   delete from ruptures;
   update dessert_stock set qty = 0;
   update team_config set takeaway_order_counter = 0;
   update pizza_stock set total = 0;
   delete from slots;
   delete from orders where date(created_at) < current_date and (scheduled_for is null or scheduled_for < current_date);
   insert into slots (restaurant_id, label, capacity)
     select tc.restaurant_id, to_char(t, ''HH24:MI''), tc.midi_capacity
     from team_config tc, generate_series(timestamp ''2000-01-01 12:00'', timestamp ''2000-01-01 15:00'', interval ''10 minutes'') t
     union all
     select tc.restaurant_id, to_char(t, ''HH24:MI''), tc.soir_capacity
     from team_config tc, generate_series(timestamp ''2000-01-01 18:00'', timestamp ''2000-01-01 23:50'', interval ''10 minutes'') t
     union all
     select tc.restaurant_id, ''24:00'', tc.soir_capacity
     from team_config tc
     on conflict (restaurant_id, label) do update set capacity = excluded.capacity;'
);

-- Permet au pizzaiolo de decider si "Sur place" reserve un creneau four (donc
-- decompte la capacite du creneau vise) ou part directement sans creneau,
-- comme "A emporter tout de suite" (voir SlotsAdmin cote equipe). Dans tous
-- les cas, le paton est decompte (remainingPizzaStock compte pizzaCount sur
-- toutes les commandes actives, quel que soit le type de service) -- seul le
-- decompte des creneaux du jour est concerne par ce reglage.
alter table team_config add column if not exists dine_in_counts_toward_slots boolean not null default true;

-- =====================================================================
-- PAIEMENT ANTICIPE (CAISSE) -- decouple le paiement du statut de la
-- commande, qui reste le seul signal utilise partout ailleurs (Four,
-- Finition, Service, Boissons, Dessert/Cafe) pour savoir si une commande est
-- encore active. Avant cette colonne, "Marquer payee" faisait les deux a la
-- fois (paiement + status="servie"), empechant la caissiere d'encaisser une
-- table pendant que sa commande est encore en preparation -- l'encaissement
-- la faisait disparaitre a tort des ecrans equipe.
alter table orders add column if not exists paid boolean not null default false;

-- =====================================================================
-- ANNULATION D'UN PASSAGE A "servie" -- filet de securite pour un clic sur
-- le mauvais bouton (ex. "Payee et servie" au lieu de "Payee, non servie"
-- en Caisse, ou "Payee" en Finition pour l'a emporter pret) : la commande
-- disparait alors a tort de tous les ecrans equipe (Four, Finition,
-- Service...). Comme aucun autre champ (items[].served, oven_done_at,
-- finition_done_at, delivered, apero_status) n'est touche par ce passage a
-- "servie", il suffit de retenir le statut et l'etat paye juste avant pour
-- restaurer la commande exactement a sa position d'origine. Colonnes
-- effacees (remises a null) une fois la restauration effectuee, pour ne
-- jamais permettre de remonter au-dela de la derniere action volontaire.
alter table orders add column if not exists previous_status text;
alter table orders add column if not exists previous_paid boolean;

-- =====================================================================
-- APPROVISIONNEMENT -- Phase 1 (fournisseurs, produits, mouvements de
-- stock). Prefixe appro_ pour ne jamais entrer en collision avec le module
-- de cout de revient existant (suppliers/ingredients/pizza_ingredients,
-- reserve a la Direction) -- deux systemes distincts avec des audiences et
-- des besoins differents, pas une fusion.
--
-- Stock PARTAGE entre Riec et Casa Di Luigi : une seule cuisine, un seul
-- pool de stock physique, une seule commande hebdomadaire pour les deux
-- adresses. Contrairement au reste du schema, ces tables n'ont donc PAS de
-- restaurant_id -- n'importe quel compte authentifie (les deux comptes de
-- service kiosque, et les managers) lit/ecrit le meme jeu de donnees,
-- exactement comme menu_items.

create table if not exists appro_suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact_name text,
  phone text,
  email text,
  delivery_day text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists appro_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null,
  primary_supplier_id uuid references appro_suppliers (id) on delete set null,
  current_stock numeric not null default 0,
  alert_threshold numeric,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Table centrale -- toute variation de stock passe obligatoirement par une
-- ligne ici, jamais par une mise a jour directe de appro_products.current_stock
-- (voir trigger appro_recalc_stock plus bas). quantity positif = entree,
-- negatif = sortie.
create table if not exists appro_stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references appro_products (id) on delete cascade,
  movement_type text not null check (movement_type in ('achat', 'vente', 'perte', 'correction', 'retour')),
  quantity numeric not null,
  reason text,
  created_by text,
  created_at timestamptz not null default now()
);

alter table appro_suppliers enable row level security;
alter table appro_products enable row level security;
alter table appro_stock_movements enable row level security;

create policy "appro_suppliers_authenticated_all" on appro_suppliers for all to authenticated using (true) with check (true);
create policy "appro_products_authenticated_all" on appro_products for all to authenticated using (true) with check (true);
create policy "appro_stock_movements_authenticated_all" on appro_stock_movements for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table appro_suppliers;
alter publication supabase_realtime add table appro_products;
alter publication supabase_realtime add table appro_stock_movements;

-- Recalcule current_stock comme la somme de tous les mouvements du produit
-- a chaque insert/update/delete -- jamais de mise a jour directe, pour
-- rester coherent meme avec Riec et Quimperle qui saisissent une reception
-- au meme moment sur des appareils differents.
create or replace function appro_recalc_stock()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update appro_products
  set current_stock = (select coalesce(sum(quantity), 0) from appro_stock_movements where product_id = coalesce(new.product_id, old.product_id))
  where id = coalesce(new.product_id, old.product_id);
  return null;
end;
$$;

create trigger appro_stock_movements_recalc
after insert or update or delete on appro_stock_movements
for each row execute function appro_recalc_stock();

insert into appro_suppliers (name) values
  ('France Boissons'), ('Grain du Ponant'), ('Danioli'), ('Sysco'),
  ('Arno and Co'), ('Ferme des Mille Loches'), ('Carniato'),
  ('Episaveurs'), ('Terreazur')
on conflict (name) do nothing;

-- =====================================================================
-- APPROVISIONNEMENT -- donnees complementaires : fournisseur emballages
-- + premiers produits identifies, chacun relie a son fournisseur
-- principal existant. appro_products n'a pas de contrainte unique sur le
-- nom (des variantes similaires restent possibles via l'ecran), d'ou le
-- garde "where not exists" plutot qu'un on conflict.

insert into appro_suppliers (name)
values ('Armor Emballages')
on conflict (name) do nothing;

insert into appro_products (name, unit, primary_supplier_id)
select v.name, v.unit, s.id
from (
  values
    ('Eau de source en bouteille 1,5L Cristaline', 'palette', 'Episaveurs'),
    ('Sel de mer fin en sachet 1kg La Tablée', 'colis', 'Episaveurs'),
    ('Regal''ad fruits en sachet 150g Krema', 'colis', 'Episaveurs'),
    ('Sac de conservation gaufré sous vide 30x40 Publiembal', 'paquet', 'Episaveurs'),
    ('Brisure de spéculoos en sachet 1,1kg Biscuiterie Brichard', 'sachet', 'Episaveurs'),
    ('Sauce pimentée en dose 4ml Gyma', 'colis', 'Episaveurs'),
    ('Miel de fleur gastronomie en squeeze 740g Lune de Miel', 'colis', 'Episaveurs'),
    ('Salade jeunes pousses roquette sauvage barquette 250g', 'barquette', 'Terreazur'),
    ('Champignon de Paris brun calibre moyen 3kg', 'colis', 'Terreazur'),
    ('Poitrine fumée', 'kg', 'Arno and Co'),
    ('Bœuf haché', 'kg', 'Arno and Co'),
    ('Courge potimarron', 'kg', 'Ferme des Mille Loches')
) as v(name, unit, supplier_name)
join appro_suppliers s on s.name = v.supplier_name
where not exists (
  select 1 from appro_products p where p.name = v.name
);

-- Les 114 produits restants du catalogue (Grain du Ponant, Sysco,
-- Danioli, Armor Emballages, France Boissons) sont seedes via
-- scripts/seed-appro-catalog.mjs -- pas de bloc SQL ici, la source est
-- deja idempotente (dedup par nom+fournisseur, ignore les noms existants).

-- =====================================================================
-- APPROVISIONNEMENT -- Phase 3 (recettes et decrementation automatique
-- du stock via les ventes).
--
-- appro_recipes : une recette par article vendable du menu (menu_items,
-- id text -- voir menu_items plus haut). Contrairement a pizza_ingredients
-- (module cout de revient, Direction), ce n'est pas une ligne libre par
-- ingredient directement liee au menu_item -- on passe par une recette
-- explicite (avec ses propres notes) pour rester coherent avec le
-- vocabulaire du cahier des charges et permettre une recette "vide"
-- (aucun ingredient) distincte de "pas encore renseignee".
create table if not exists appro_recipes (
  id uuid primary key default gen_random_uuid(),
  menu_item_id text not null
    references menu_items (id)
    on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  unique (menu_item_id)
);

create table if not exists appro_recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null
    references appro_recipes (id)
    on delete cascade,
  product_id uuid not null
    references appro_products (id)
    on delete restrict,
  quantity_per_unit numeric not null,
  unit text not null,
  unique (recipe_id, product_id)
);

alter table appro_recipes
  enable row level security;
alter table appro_recipe_ingredients
  enable row level security;

create policy "appro_recipes_authenticated_all"
  on appro_recipes
  for all
  to authenticated
  using (true)
  with check (true);

create policy "appro_recipe_ingredients_authenticated_all"
  on appro_recipe_ingredients
  for all
  to authenticated
  using (true)
  with check (true);

alter publication supabase_realtime
  add table appro_recipes;
alter publication supabase_realtime
  add table appro_recipe_ingredients;

-- Tracabilite : quel mouvement de stock vient de quelle commande (utile
-- pour deboguer/auditer une decrementation automatique).
alter table appro_stock_movements
  add column if not exists order_id uuid
    references orders (id)
    on delete set null;

-- Garde-fou anti double-decompte : une commande ne decremente le stock
-- qu'une seule fois dans sa vie, la premiere fois qu'elle passe a
-- "servie" (voir markOrderServed cote appli). Le bouton "Restaurer"
-- (filet de securite ajoute precedemment) ne remet JAMAIS cette colonne
-- a null -- corriger une erreur de clic sur le statut/paiement ne doit
-- pas laisser croire que la nourriture n'a pas ete reellement consommee.
alter table orders
  add column if not exists stock_decremented_at timestamptz;

-- Produit mis en avant sur l'ecran client (badge « Best-seller » sur la carte,
-- kiosque + click & collect). Pilote depuis l'admin Menu ; sans effet ailleurs.
alter table menu_items
  add column if not exists featured boolean not null default false;

-- =====================================================================
-- Engagement client sur les commandes en ligne (click & collect) — anti
-- no-show, SANS compte client. Une ligne order_commitments par commande
-- passee depuis /commande : telephone brut (aucun rapprochement avec un
-- profil), acceptation CGV horodatee, COPIE INTEGRALE du texte CGV affiche
-- au moment de l'acceptation (pas une simple reference de version), et IP
-- capturee cote serveur par la Route Handler /api/commande.
-- =====================================================================
create table if not exists order_commitments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null
    references orders (id) on delete cascade,
  restaurant_id text references restaurants (id),
  customer_phone text not null,
  commitment_accepted boolean not null default false,
  commitment_accepted_at timestamptz,
  cgv_text_snapshot text not null,
  cgv_version text,
  ip_address text,
  order_status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table order_commitments
  drop constraint if exists order_commitments_status_chk;
alter table order_commitments
  add constraint order_commitments_status_chk
  check (order_status in
    ('pending', 'picked_up', 'no_show', 'cancelled'));

create index if not exists order_commitments_order_id_idx
  on order_commitments (order_id);
create index if not exists order_commitments_phone_idx
  on order_commitments (customer_phone);

alter table order_commitments enable row level security;

drop policy if exists "order_commitments_select"
  on order_commitments;
drop policy if exists "order_commitments_write"
  on order_commitments;

create policy "order_commitments_select"
  on order_commitments
  for select to authenticated
  using (
    restaurant_id = my_restaurant_id() or is_manager()
  );

create policy "order_commitments_write"
  on order_commitments
  for all to authenticated
  using (restaurant_id = my_restaurant_id())
  with check (restaurant_id = my_restaurant_id());

-- Insertion ATOMIQUE commande + engagement pour le click & collect.
-- security invoker : tourne avec les droits de l'appelant (comme
-- insertOrder cote client aujourd'hui), donc la RLS et
-- my_restaurant_id() s'appliquent normalement. next_takeaway_number()
-- reste security definer et keye sur auth.uid(). L'IP arrive de la
-- Route Handler serveur (jamais du client SQL).
drop function if exists create_takeaway_order(
  jsonb, text, text, jsonb, integer, numeric,
  text, text, text, text
);

create or replace function create_takeaway_order(
  p_items jsonb,
  p_service_type text,
  p_name text,
  p_slot_allocations jsonb,
  p_pizza_count integer,
  p_total numeric,
  p_customer_phone text,
  p_cgv_text_snapshot text,
  p_cgv_version text,
  p_ip_address text
)
returns table (order_id uuid, takeaway_number integer)
language plpgsql
security invoker
set search_path = public
as $func$
declare
  v_rid text := my_restaurant_id();
  v_num integer := next_takeaway_number();
  v_order_id uuid;
begin
  insert into orders (
    restaurant_id,
    items,
    service_type,
    name,
    slot_allocations,
    pizza_count,
    total,
    status,
    takeaway_number
  )
  values (
    v_rid,
    p_items,
    p_service_type,
    p_name,
    coalesce(p_slot_allocations, '[]'::jsonb),
    coalesce(p_pizza_count, 0),
    coalesce(p_total, 0),
    'attente',
    v_num
  )
  returning id into v_order_id;

  insert into order_commitments (
    order_id,
    restaurant_id,
    customer_phone,
    commitment_accepted,
    commitment_accepted_at,
    cgv_text_snapshot,
    cgv_version,
    ip_address,
    order_status
  )
  values (
    v_order_id,
    v_rid,
    p_customer_phone,
    true,
    now(),
    p_cgv_text_snapshot,
    p_cgv_version,
    p_ip_address,
    'pending'
  );

  -- Fidelite : credite les points sur le numero deja collecte pour
  -- l'engagement client. award_loyalty_points est security definer (donc
  -- insensible a la RLS de cette fonction security invoker) et normalise
  -- lui-meme le telephone. JAMAIS bloquant : une erreur cote fidelite ne
  -- doit pas faire echouer la commande.
  begin
    perform award_loyalty_points(p_customer_phone, coalesce(p_total, 0), v_order_id, 'click_and_collect');
  exception when others then
    null;
  end;

  order_id := v_order_id;
  takeaway_number := v_num;
  return next;
end;
$func$;

grant execute on function create_takeaway_order(
  jsonb, text, text, jsonb, integer, numeric,
  text, text, text, text
) to authenticated;

-- =====================================================================
-- FIDÉLITÉ CASA — remplace Zerosix. Système maison intégré à l'app.
--
-- Base clients PARTAGÉE entre les deux restaurants (une seule enseigne côté
-- client, un seul solde de points, un seul programme) : comme menu_items /
-- ingredients / appro_*, ces tables n'ont PAS de restaurant_id. La provenance
-- d'un gain est tracée par loyalty_movements.source (click_and_collect / caisse).
--
-- Règles métier (cahier des charges, définitives) :
--   - 1 point = 1 € dépensé, arrondi à l'euro inférieur (floor), sans expiration.
--   - 150 points => bon de 5 €, CUMULABLE (300 => 2 bons, 450 => 3, ...).
--   - Anniversaire => bon de 5 € automatique, indépendant du solde.
--   - Bons valides 21 jours puis statut 'expire' (jamais supprimés).
--     Réactivation manuelle => repasse 'actif' avec expires_at = now() + 21 j.
--   - Identifiant client unique = téléphone normalisé (0XXXXXXXXX), pas d'email.
-- =====================================================================

-- ------------------------------------------------------- loyalty_customers --
create table if not exists loyalty_customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,               -- forme canonique 0XXXXXXXXX
  nom text,
  date_anniversaire date,
  solde_points integer not null default 0,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------- loyalty_movements --
create table if not exists loyalty_movements (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references loyalty_customers (id) on delete cascade,
  type text not null check (type in ('gain', 'depense', 'ajustement')),
  points integer not null,
  order_id uuid references orders (id) on delete set null,
  source text check (source in ('click_and_collect', 'caisse')),
  created_at timestamptz not null default now()
);
create index if not exists loyalty_movements_customer_id_idx
  on loyalty_movements (customer_id);

-- -------------------------------------------------------- loyalty_messages --
-- Créée maintenant, alimentée seulement quand les SMS OVH seront branchés.
create table if not exists loyalty_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references loyalty_customers (id) on delete cascade,
  type text not null check (type in ('anniversaire', 'recompense', 'promo', 'bienvenue')),
  contenu text,
  statut text not null default 'en_attente' check (statut in ('envoye', 'echec', 'en_attente')),
  sent_at timestamptz
);

-- ------------------------------------------------------------- promo_codes --
create table if not exists promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_id uuid references loyalty_customers (id) on delete cascade,
  reduction numeric(10, 2) not null,
  reason text not null check (reason in ('palier_150', 'anniversaire', 'manuel')),
  status text not null default 'actif' check (status in ('actif', 'expire', 'utilise')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists promo_codes_customer_id_idx on promo_codes (customer_id);
create index if not exists promo_codes_status_expires_idx on promo_codes (status, expires_at);

-- 'manuel' : bon ajouté à la main depuis la fiche client (geste commercial).
-- Même validité 21 j, même cron d'expiration et même réactivation que les
-- bons automatiques. Migration pour une base déjà créée :
alter table promo_codes drop constraint if exists promo_codes_reason_check;
alter table promo_codes add constraint promo_codes_reason_check
  check (reason in ('palier_150', 'anniversaire', 'manuel'));

-- RLS : accès complet pour tout compte authentifié (les deux comptes de
-- service kiosque + les managers), comme menu_items / appro_*. La logique
-- sensible (attribution, paliers) passe par des fonctions security definer.
alter table loyalty_customers enable row level security;
alter table loyalty_movements enable row level security;
alter table loyalty_messages enable row level security;
alter table promo_codes enable row level security;

drop policy if exists "loyalty_customers_authenticated_all" on loyalty_customers;
drop policy if exists "loyalty_movements_authenticated_all" on loyalty_movements;
drop policy if exists "loyalty_messages_authenticated_all" on loyalty_messages;
drop policy if exists "promo_codes_authenticated_all" on promo_codes;

create policy "loyalty_customers_authenticated_all" on loyalty_customers for all to authenticated using (true) with check (true);
create policy "loyalty_movements_authenticated_all" on loyalty_movements for all to authenticated using (true) with check (true);
create policy "loyalty_messages_authenticated_all" on loyalty_messages for all to authenticated using (true) with check (true);
create policy "promo_codes_authenticated_all" on promo_codes for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table loyalty_customers;
alter publication supabase_realtime add table loyalty_movements;
alter publication supabase_realtime add table loyalty_messages;
alter publication supabase_realtime add table promo_codes;

-- Dernière activité du client (dernier gain de points). Sert au job de purge
-- des comptes inactifs (voir loyalty-purge-inactifs plus bas). Pour les comptes
-- importés de Zerosix, à réalimenter depuis la colonne « Dernier passage » de
-- l'export via scripts/emit-zerosix-last-activity-sql.mjs.
alter table loyalty_customers
  add column if not exists last_activity_at timestamptz not null default now();

-- ------------------------------------------------- award_loyalty_points() --
-- Point d'entrée unique de l'attribution de points, appelé aussi bien par la
-- caisse (client -> rpc) que par le click & collect (create_takeaway_order).
-- security definer : contourne la RLS et tourne pareil dans les deux chemins.
-- Cherche le client par téléphone normalisé, le crée si besoin, insère un
-- mouvement 'gain' et met à jour le solde. Renvoie le nouveau solde (ou null
-- si le numéro est invalide -- rien n'est écrit dans ce cas).
create or replace function award_loyalty_points(
  p_phone text,
  p_amount numeric,
  p_order_id uuid,
  p_source text
)
returns integer
language plpgsql
security definer
set search_path = public
as $award$
declare
  v_phone text;
  v_customer_id uuid;
  v_points integer;
  v_new_solde integer;
begin
  -- Normalisation défensive : retire séparateurs, ramène +33.../0033... au 0
  -- (métropole) et +590.../+594... au 0 (Guadeloupe / Guyane).
  v_phone := regexp_replace(coalesce(p_phone, ''), '[\s.\-()]', '', 'g');
  if v_phone like '+33%' then
    v_phone := '0' || substr(v_phone, 4);
  elsif v_phone like '0033%' then
    v_phone := '0' || substr(v_phone, 5);
  elsif v_phone like '+590%' then
    v_phone := '0' || substr(v_phone, 5);
  elsif v_phone like '+594%' then
    v_phone := '0' || substr(v_phone, 5);
  end if;
  if v_phone !~ '^0[1-9][0-9]{8}$' then
    return null;
  end if;

  insert into loyalty_customers (phone)
  values (v_phone)
  on conflict (phone) do nothing;

  select id into v_customer_id from loyalty_customers where phone = v_phone;

  v_points := floor(coalesce(p_amount, 0))::integer;
  if v_points <= 0 then
    -- Passage sans point gagné (montant nul) : compte quand même comme une
    -- activité pour la purge des comptes inactifs.
    update loyalty_customers set last_activity_at = now() where id = v_customer_id
      returning solde_points into v_new_solde;
    return v_new_solde;
  end if;

  -- Le solde est mis à jour AVANT l'insertion du mouvement : le trigger
  -- palier (AFTER INSERT sur loyalty_movements) lit loyalty_customers.solde_points
  -- et doit donc y voir le nouveau total, pas l'ancien.
  update loyalty_customers
  set solde_points = solde_points + v_points,
      last_activity_at = now()
  where id = v_customer_id
  returning solde_points into v_new_solde;

  insert into loyalty_movements (customer_id, type, points, order_id, source)
  values (v_customer_id, 'gain', v_points, p_order_id, p_source);

  return v_new_solde;
end;
$award$;

grant execute on function award_loyalty_points(text, numeric, uuid, text) to authenticated;

-- --------------------------------------------- trigger palier 150 points --
-- Après chaque mouvement : génère autant de bons palier_150 (5 €, 21 j) que
-- le solde en donne droit et qu'il n'en existe pas déjà. Idempotent et
-- cumulable (300 => 2 bons). Un ajustement négatif ne révoque jamais un bon
-- déjà émis (la boucle ne fait rien si earned - existing <= 0).
-- Le trigger lit loyalty_customers.solde_points tel quel : tout code qui
-- insère un mouvement à la main (ajustement, depense, migration) doit avoir
-- mis le solde à jour AVANT l'insert, comme le fait award_loyalty_points.
create or replace function loyalty_reward_palier_150()
returns trigger
language plpgsql
security definer
set search_path = public
as $palier$
declare
  v_solde integer;
  v_earned integer;
  v_existing integer;
  i integer;
begin
  select solde_points into v_solde from loyalty_customers where id = new.customer_id;
  v_earned := floor(v_solde / 150.0)::integer;
  select count(*) into v_existing
  from promo_codes
  where customer_id = new.customer_id and reason = 'palier_150';

  for i in 1 .. (v_earned - v_existing) loop
    insert into promo_codes (code, customer_id, reduction, reason, status, expires_at)
    values (
      'CASA-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
      new.customer_id,
      5.00,
      'palier_150',
      'actif',
      now() + interval '21 days'
    );
  end loop;

  return null;
end;
$palier$;

drop trigger if exists loyalty_movements_palier_150 on loyalty_movements;
create trigger loyalty_movements_palier_150
after insert on loyalty_movements
for each row execute function loyalty_reward_palier_150();

-- ------------------------------------------------- jobs quotidiens (cron) --
-- pg_cron pur (pas d'Edge Function) : mêmes conventions que le job
-- 'casa-di-nathano-daily-reset' plus haut. ~05:00 heure du projet.

-- Bons anniversaire : un bon de 5 € (21 j) le jour anniversaire de chaque
-- client. Le NOT EXISTS protège d'un double passage et du cas 29/02.
select cron.schedule(
  'loyalty-anniversaires',
  '0 5 * * *',
  $$
    insert into promo_codes (code, customer_id, reduction, reason, status, expires_at)
    select 'CASA-' || upper(substr(md5(random()::text || lc.id::text), 1, 6)),
           lc.id, 5.00, 'anniversaire', 'actif', now() + interval '21 days'
    from loyalty_customers lc
    where lc.date_anniversaire is not null
      and to_char(lc.date_anniversaire, 'MM-DD') = to_char(current_date, 'MM-DD')
      and not exists (
        select 1 from promo_codes p
        where p.customer_id = lc.id
          and p.reason = 'anniversaire'
          and p.created_at::date = current_date
      );
  $$
);

-- Expiration des bons non utilisés : 'actif' -> 'expire' passé expires_at.
select cron.schedule(
  'loyalty-expire-bons',
  '0 5 * * *',
  $$
    update promo_codes
    set status = 'expire'
    where status = 'actif' and expires_at < now();
  $$
);

-- Purge des comptes fidélité inactifs depuis plus de 18 mois (demande de la
-- direction). Le 1er de chaque mois à 05:30. Suppression définitive : les
-- mouvements, messages et bons du client partent en cascade (FK on delete
-- cascade). Le solde de points restant est perdu, c'est volontaire.
-- `last_activity_at` = dernier gain de points (voir award_loyalty_points), ou
-- pour les comptes Zerosix la date de « Dernier passage » de l'export
-- (backfill via scripts/emit-zerosix-last-activity-sql.mjs).
select cron.schedule(
  'loyalty-purge-inactifs',
  '30 5 1 * *',
  $$
    delete from loyalty_customers
    where last_activity_at < now() - interval '18 months';
  $$
);

-- Pour désactiver : select cron.unschedule('loyalty-purge-inactifs');

-- Pour désactiver plus tard :
--   select cron.unschedule('loyalty-anniversaires');
--   select cron.unschedule('loyalty-expire-bons');

-- ----------------------------------------- recherche client (écran Fidélité) --
-- Recherche souple : par nom/prénom (colonne `nom` = "Prénom NOM"),
-- insensible à la casse ET aux accents ("clemence" trouve "Clémence"), ou
-- par fragment de numéro si le terme est surtout numérique (>= 4 chiffres).
-- Passe par une fonction car supabase-js ne peut pas appeler unaccent() dans
-- un .ilike(). Volume faible (~1700 lignes) => pas d'index dédié nécessaire.
create extension if not exists unaccent;

create or replace function search_loyalty_customers(p_term text)
returns setof loyalty_customers
language plpgsql
stable
set search_path = public, extensions
as $search$
declare
  v_term text := trim(coalesce(p_term, ''));
  v_digits text := regexp_replace(coalesce(p_term, ''), '[\s.\-()+]', '', 'g');
begin
  if length(v_term) < 2 then
    return;
  end if;

  if v_digits ~ '^[0-9]{4,}$' then
    return query
      select * from loyalty_customers
      where phone like '%' || v_digits || '%'
      order by nom nulls last
      limit 50;
  else
    return query
      select * from loyalty_customers
      where unaccent(coalesce(nom, '')) ilike '%' || unaccent(v_term) || '%'
      order by nom nulls last
      limit 50;
  end if;
end;
$search$;

grant execute on function search_loyalty_customers(text) to authenticated;

-- --------------------------------------- gabarits de messages fidélité --
-- Textes des SMS fidélité, éditables depuis l'espace Direction (managers).
-- Le contenu est paramétré maintenant ; l'envoi effectif (API OVH) viendra
-- avec la phase G, une fois le nouveau système de caisse en place.
-- Placeholders remplacés à l'envoi : {restaurant} {prenom} {code} {expiration}.
--   bienvenue       : à la création du compte fidélité
--   avis_google     : au 3e passage du client (demande d'avis Google)
--   anniversaire    : le jour de l'anniversaire, avec le bon de 5 €
--   recompense_150  : au franchissement d'un multiple de 150 points, avec le bon
create table if not exists loyalty_message_templates (
  key text primary key,
  label text not null,
  body text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table loyalty_message_templates enable row level security;
drop policy if exists "loyalty_message_templates_select" on loyalty_message_templates;
drop policy if exists "loyalty_message_templates_write" on loyalty_message_templates;
drop policy if exists "loyalty_message_templates_update" on loyalty_message_templates;
drop policy if exists "loyalty_message_templates_delete" on loyalty_message_templates;
create policy "loyalty_message_templates_select" on loyalty_message_templates for select to authenticated using (true);
create policy "loyalty_message_templates_write" on loyalty_message_templates for insert to authenticated with check (is_manager());
create policy "loyalty_message_templates_update" on loyalty_message_templates for update to authenticated using (is_manager()) with check (is_manager());
create policy "loyalty_message_templates_delete" on loyalty_message_templates for delete to authenticated using (is_manager());

do $$
begin
  begin
    execute 'alter publication supabase_realtime add table loyalty_message_templates';
  exception when duplicate_object then null;
  end;
end $$;

insert into loyalty_message_templates (key, label, body) values
  ('bienvenue', 'Message de bienvenue',
   'Bienvenue chez {restaurant} ! Votre carte de fidelite est active : 1 point par euro depense, et un bon de 5 EUR tous les 150 points. A tres vite !'),
  ('avis_google', 'Demande d''avis Google (apres 3 passages)',
   'Merci de votre visite chez {restaurant} ! Si vous avez passe un bon moment, votre avis Google compte beaucoup pour nous : [collez ici votre lien Google]. Merci !'),
  ('anniversaire', 'Message d''anniversaire',
   'Joyeux anniversaire de la part de {restaurant} ! Pour feter ca, un bon de 5 EUR vous attend (code {code}), valable jusqu''au {expiration}. A bientot !'),
  ('recompense_150', 'Bon de 5 EUR - palier 150 points',
   'Bravo {prenom} ! Vous avez atteint 150 points chez {restaurant} : un bon de 5 EUR est a vous (code {code}), valable jusqu''au {expiration}. Merci de votre fidelite !')
on conflict (key) do nothing;
