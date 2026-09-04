-- =====================================================================
-- SAT — Phase 7 : reporting de la répartition des sources de commande.
-- Suit la part des lignes/commandes saisies par le client (sat +
-- click_and_collect) vs par la serveuse (source NULL).
--
-- Additif pur : nouvelle table + nouveau job cron. NE MODIFIE PAS le job
-- 'casa-di-nathano-daily-reset'. À exécuter une fois dans Supabase.
-- Blocs séparés (le SQL Editor découpe sur « ; » en fin de ligne).
-- =====================================================================

-- ---------------------------------------------------------------------
-- BLOC 1 — table d'archive (une ligne par restaurant et par jour).
-- ---------------------------------------------------------------------
create table if not exists source_stats_daily (
  restaurant_id text not null references restaurants (id),
  date date not null,
  lines_total integer not null default 0,
  lines_serveuse integer not null default 0,
  lines_sat integer not null default 0,
  lines_click_and_collect integer not null default 0,
  orders_total integer not null default 0,
  orders_with_autonomy integer not null default 0,
  primary key (restaurant_id, date)
);

alter table source_stats_daily enable row level security;

drop policy if exists "source_stats_daily_select" on source_stats_daily;
create policy "source_stats_daily_select" on source_stats_daily
  for select to authenticated
  using (restaurant_id = my_restaurant_id() or is_manager());

alter publication supabase_realtime add table source_stats_daily;

-- ---------------------------------------------------------------------
-- BLOC 2 — job quotidien à 03:50, AVANT le reset de 04:00 qui supprime
-- les commandes de la veille. Corps = une seule instruction (insert …
-- select … on conflict), aucun « ; » interne. Les commandes du jour
-- courant ne sont pas encore figées : on n'archive que les jours
-- révolus (comme daily_sales), et on ré-upserte en cas de rejeu.
-- Une commande sans aucun article (cas théorique) est ignorée.
-- ---------------------------------------------------------------------
select cron.schedule(
  'sat-source-stats-daily',
  '50 3 * * *',
  'insert into source_stats_daily (restaurant_id, date, lines_total, lines_serveuse, lines_sat, lines_click_and_collect, orders_total, orders_with_autonomy)
   select o.restaurant_id, date(o.created_at),
     count(*),
     count(*) filter (where (it ->> ''source'') is null),
     count(*) filter (where it ->> ''source'' = ''sat''),
     count(*) filter (where it ->> ''source'' = ''click_and_collect''),
     count(distinct o.id),
     count(distinct o.id) filter (where exists (select 1 from jsonb_array_elements(o.items) x where (x ->> ''source'') is not null))
   from orders o cross join lateral jsonb_array_elements(o.items) it
   where date(o.created_at) < current_date and (o.scheduled_for is null or o.scheduled_for < current_date) and o.is_test = false
   group by o.restaurant_id, date(o.created_at)
   on conflict (restaurant_id, date) do update set
     lines_total = excluded.lines_total,
     lines_serveuse = excluded.lines_serveuse,
     lines_sat = excluded.lines_sat,
     lines_click_and_collect = excluded.lines_click_and_collect,
     orders_total = excluded.orders_total,
     orders_with_autonomy = excluded.orders_with_autonomy'
);

-- Pour désactiver plus tard : select cron.unschedule('sat-source-stats-daily');

-- ---------------------------------------------------------------------
-- BLOC 3 (optionnel) — amorcer l'historique avec la journée d'hier si
-- des commandes de la veille sont encore présentes au moment où on joue
-- cette migration (sinon l'archive ne démarrera qu'après le prochain
-- passage du cron). Ne casse rien si la table orders ne contient que le
-- jour courant.
-- ---------------------------------------------------------------------
insert into source_stats_daily (restaurant_id, date, lines_total, lines_serveuse, lines_sat, lines_click_and_collect, orders_total, orders_with_autonomy)
select o.restaurant_id, date(o.created_at),
  count(*),
  count(*) filter (where (it ->> 'source') is null),
  count(*) filter (where it ->> 'source' = 'sat'),
  count(*) filter (where it ->> 'source' = 'click_and_collect'),
  count(distinct o.id),
  count(distinct o.id) filter (where exists (select 1 from jsonb_array_elements(o.items) x where (x ->> 'source') is not null))
from orders o cross join lateral jsonb_array_elements(o.items) it
where date(o.created_at) < current_date and (o.scheduled_for is null or o.scheduled_for < current_date) and o.is_test = false
group by o.restaurant_id, date(o.created_at)
on conflict (restaurant_id, date) do nothing;

notify pgrst, 'reload schema';
