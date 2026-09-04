-- =====================================================================
-- COMMANDE À TABLE AUTONOME (« SAT » — Service À Table)
-- Phase 1 : structure. Additif pur — aucune ligne existante modifiée,
-- aucun code applicatif ne s'en sert encore.
--
-- À exécuter une fois dans Supabase → SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Registre des tables physiques du restaurant. Désactivation (active =
-- false) plutôt que suppression dure, pour préserver l'intégrité des
-- commandes historiques qui référencent une table (orders.table_ids).
-- ---------------------------------------------------------------------
create table if not exists tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null references restaurants (id),
  number text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (restaurant_id, number)
);

alter table tables enable row level security;

-- Lecture : son propre restaurant OU la Direction. Écriture : son propre
-- restaurant uniquement. Même schéma que orders/slots/… (voir schema.sql).
drop policy if exists "tables_select" on tables;
drop policy if exists "tables_write" on tables;
create policy "tables_select" on tables for select to authenticated using (restaurant_id = my_restaurant_id() or is_manager());
create policy "tables_write" on tables for all to authenticated using (restaurant_id = my_restaurant_id()) with check (restaurant_id = my_restaurant_id());

-- Publication realtime (sinon les créations/désactivations de table ne
-- rafraîchissent pas l'écran des autres appareils sans rechargement).
-- Si la table est déjà membre, cette ligne renvoie une erreur inoffensive.
alter publication supabase_realtime add table tables;

-- ---------------------------------------------------------------------
-- orders : rattachement structuré à une ou plusieurs tables (tables
-- collées) + libellé texte libre en parallèle (tables non enregistrées,
-- transition). Nullable / défaut vide : les commandes existantes restent
-- valides sans backfill.
-- ---------------------------------------------------------------------
alter table orders add column if not exists table_ids text[] not null default '{}';
alter table orders add column if not exists table_label text;

-- ---------------------------------------------------------------------
-- Ajout ATOMIQUE d'articles à une commande sur place déjà ouverte —
-- appelé aussi bien par la prise de commande serveuse (StaffOrderFlow)
-- que par le lien client /sat. Un seul UPDATE : aucune course possible
-- si la serveuse et le client valident au même instant.
--
-- language sql / corps sans point-virgule interne : le SQL Editor découpe
-- les instructions sur « ; », un corps multi-lignes plpgsql serait cassé.
-- security invoker par défaut : la RLS de orders (restaurant_id =
-- my_restaurant_id()) s'applique normalement, comme create_takeaway_order.
--
-- p_reopen_kitchen : calculé côté client (le nouvel ajout comporte des
-- articles qui passent par le four/la finition). Rouvre le circuit cuisine
-- UNIQUEMENT si la commande l'avait déjà dépassé — réplique du garde-fou
-- de EditOrderModal.save(). Les items[].served ne sont jamais touchés :
-- un article déjà en finition ne régresse pas.
-- ---------------------------------------------------------------------
create or replace function sat_append_items(
  p_order_id uuid,
  p_items jsonb,
  p_added_total numeric,
  p_added_pizza_count integer,
  p_reopen_kitchen boolean,
  p_extra_table_ids text[]
)
returns void
language sql
set search_path = public
as $fn$
  update orders o
  set items = o.items || coalesce(p_items, '[]'::jsonb),
      total = o.total + coalesce(p_added_total, 0),
      pizza_count = o.pizza_count + coalesce(p_added_pizza_count, 0),
      table_ids = (select coalesce(array_agg(distinct e order by e), '{}') from unnest(o.table_ids || coalesce(p_extra_table_ids, '{}'::text[])) as e),
      status = case when coalesce(p_reopen_kitchen, false) and o.status not in ('attente', 'preparation') then 'attente' else o.status end,
      delivered = case when coalesce(p_reopen_kitchen, false) and o.status not in ('attente', 'preparation') then false else o.delivered end,
      apero_status = case when o.apero_status = 'served_by_kitchen' then 'released' else o.apero_status end
  where o.id = p_order_id
$fn$;

grant execute on function sat_append_items(uuid, jsonb, numeric, integer, boolean, text[]) to authenticated;

notify pgrst, 'reload schema';
