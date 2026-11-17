-- =====================================================================
-- LIVRAISON (livraison par l'équipe du restaurant)
--
-- Additif, non cassant : rien n'est visible côté client tant que
-- delivery_settings.enabled reste à false pour l'établissement.
-- À coller dans Supabase → SQL Editor.
--
-- Ce que ça met en place :
--   1. delivery_settings    : réglages par restaurant (activation, mode de
--                             tarif, rayon max, minimum, position GPS).
--   2. delivery_zones       : tarifs par commune / code postal (mode 'zone').
--   3. delivery_fee_tiers   : tranches de distance (mode 'distance').
--   4. orders.delivery_*    : adresse, frais, statut de livraison.
--   5. compute_delivery_quote()  : calcule frais + éligibilité CÔTÉ SERVEUR
--                                  (distance à vol d'oiseau, formule de
--                                  haversine) — le client ne fixe jamais
--                                  lui-même le prix de la livraison.
--   6. create_delivery_order()   : insère commande + engagement CGV, comme
--                                  create_takeaway_order, en revalidant tout.
--
-- Modes de tarif (delivery_settings.fee_mode), au choix de la Direction :
--   'zone'     : un tarif fixe par zone (delivery_zones, par code postal).
--   'flat'     : un tarif fixe unique, dans la limite de max_radius_km.
--   'distance' : tarif selon la distance restaurant → client, soit par
--                tranches (distance_pricing = 'tiers'), soit base + prix au
--                km (distance_pricing = 'per_km'), dans la limite de
--                max_radius_km.
--
-- Paiement : pas encore en ligne. Paiement au livreur à la livraison.
-- Le champ orders.total = sous-total articles + frais de livraison.
-- Les points de fidélité sont crédités sur le sous-total articles
-- uniquement (les frais de livraison ne donnent pas de points).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Réglages par restaurant
-- ---------------------------------------------------------------------
create table if not exists delivery_settings (
  restaurant_id text primary key references restaurants (id) on delete cascade,
  enabled boolean not null default false,
  fee_mode text not null default 'flat' check (fee_mode in ('zone', 'flat', 'distance')),
  flat_fee numeric(6, 2) not null default 0 check (flat_fee >= 0),
  distance_pricing text not null default 'tiers' check (distance_pricing in ('tiers', 'per_km')),
  per_km_base numeric(6, 2) not null default 0 check (per_km_base >= 0),
  per_km_rate numeric(6, 2) not null default 0 check (per_km_rate >= 0),
  max_radius_km numeric(5, 2) not null default 5 check (max_radius_km > 0),
  min_order numeric(6, 2) not null default 0 check (min_order >= 0),
  free_delivery_from numeric(6, 2) check (free_delivery_from is null or free_delivery_from >= 0),
  estimated_minutes integer not null default 30 check (estimated_minutes > 0),
  restaurant_lat double precision,
  restaurant_lng double precision,
  updated_at timestamptz not null default now()
);

-- Une ligne (désactivée) pour chaque restaurant existant.
insert into delivery_settings (restaurant_id)
select id from restaurants
on conflict (restaurant_id) do nothing;

-- ---------------------------------------------------------------------
-- 2. Zones (mode 'zone') : un code postal = une zone
-- ---------------------------------------------------------------------
create table if not exists delivery_zones (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null references restaurants (id) on delete cascade,
  label text not null,                 -- ex. "Riec-sur-Belon"
  postal_code text not null,           -- ex. "29340"
  fee numeric(6, 2) not null default 0 check (fee >= 0),
  min_order numeric(6, 2) check (min_order is null or min_order >= 0), -- null = minimum général
  active boolean not null default true,
  unique (restaurant_id, postal_code)
);

-- ---------------------------------------------------------------------
-- 3. Tranches de distance (mode 'distance', tarification 'tiers')
--    "jusqu'à up_to_km km : fee €". Au-delà de la dernière tranche (ou de
--    max_radius_km) : hors zone.
-- ---------------------------------------------------------------------
create table if not exists delivery_fee_tiers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null references restaurants (id) on delete cascade,
  up_to_km numeric(5, 2) not null check (up_to_km > 0),
  fee numeric(6, 2) not null default 0 check (fee >= 0),
  unique (restaurant_id, up_to_km)
);

-- ---------------------------------------------------------------------
-- RLS : lecture pour son propre restaurant (la borne client se connecte
-- avec le compte du restaurant) ou la Direction ; écriture Direction seule.
-- ---------------------------------------------------------------------
alter table delivery_settings enable row level security;
alter table delivery_zones enable row level security;
alter table delivery_fee_tiers enable row level security;

drop policy if exists "delivery_settings_read" on delivery_settings;
create policy "delivery_settings_read" on delivery_settings for select to authenticated
  using (restaurant_id = my_restaurant_id() or is_manager());
drop policy if exists "delivery_settings_manager_write" on delivery_settings;
create policy "delivery_settings_manager_write" on delivery_settings for all to authenticated
  using (is_manager()) with check (is_manager());

drop policy if exists "delivery_zones_read" on delivery_zones;
create policy "delivery_zones_read" on delivery_zones for select to authenticated
  using (restaurant_id = my_restaurant_id() or is_manager());
drop policy if exists "delivery_zones_manager_write" on delivery_zones;
create policy "delivery_zones_manager_write" on delivery_zones for all to authenticated
  using (is_manager()) with check (is_manager());

drop policy if exists "delivery_fee_tiers_read" on delivery_fee_tiers;
create policy "delivery_fee_tiers_read" on delivery_fee_tiers for select to authenticated
  using (restaurant_id = my_restaurant_id() or is_manager());
drop policy if exists "delivery_fee_tiers_manager_write" on delivery_fee_tiers;
create policy "delivery_fee_tiers_manager_write" on delivery_fee_tiers for all to authenticated
  using (is_manager()) with check (is_manager());

-- ---------------------------------------------------------------------
-- 4. Colonnes livraison sur les commandes
-- ---------------------------------------------------------------------
alter table orders add column if not exists delivery_address text;
alter table orders add column if not exists delivery_postal_code text;
alter table orders add column if not exists delivery_city text;
alter table orders add column if not exists delivery_lat double precision;
alter table orders add column if not exists delivery_lng double precision;
alter table orders add column if not exists delivery_distance_km numeric(5, 2);
alter table orders add column if not exists delivery_fee numeric(6, 2) not null default 0;
alter table orders add column if not exists delivery_instructions text; -- code porte, étage, etc.
-- Téléphone du client, recopié ici pour que le livreur le voie sur son écran
-- (la preuve d'engagement order_commitments garde l'original).
alter table orders add column if not exists delivery_phone text;
-- Statut propre à la livraison (indépendant du statut cuisine `status`) :
-- null = pas une livraison.
alter table orders add column if not exists delivery_status text
  check (delivery_status is null or delivery_status in ('a_livrer', 'en_route', 'livree', 'annulee'));
alter table orders add column if not exists delivery_driver text;
alter table orders add column if not exists delivery_started_at timestamptz;
alter table orders add column if not exists delivered_at timestamptz;

create index if not exists orders_delivery_status_idx on orders (delivery_status)
  where delivery_status is not null;

-- ---------------------------------------------------------------------
-- 5. Devis de livraison — source de vérité du prix et de l'éligibilité.
--    security invoker : s'exécute avec les droits de l'appelant, donc
--    la RLS et my_restaurant_id() s'appliquent (borne = un restaurant).
-- ---------------------------------------------------------------------
create or replace function compute_delivery_quote(
  p_lat double precision,
  p_lng double precision,
  p_postal_code text,
  p_subtotal numeric
)
returns table (
  deliverable boolean,
  reason text,
  distance_km numeric,
  fee numeric,
  min_order numeric,
  estimated_minutes integer
)
language plpgsql
stable
security invoker
set search_path = public
as $func$
declare
  v_rid text := my_restaurant_id();
  s delivery_settings%rowtype;
  v_dist numeric := null;
  v_fee numeric := 0;
  v_min numeric := 0;
  v_zone delivery_zones%rowtype;
begin
  select * into s from delivery_settings where restaurant_id = v_rid;

  if not found or not s.enabled then
    return query select false, 'Livraison indisponible pour le moment.', null::numeric, 0::numeric, 0::numeric, null::integer;
    return;
  end if;

  v_min := s.min_order;

  -- Distance à vol d'oiseau (haversine), si on a les deux positions.
  if p_lat is not null and p_lng is not null
     and s.restaurant_lat is not null and s.restaurant_lng is not null then
    v_dist := round((
      2 * 6371 * asin(sqrt(
        power(sin(radians(p_lat - s.restaurant_lat) / 2), 2)
        + cos(radians(s.restaurant_lat)) * cos(radians(p_lat))
          * power(sin(radians(p_lng - s.restaurant_lng) / 2), 2)
      ))
    )::numeric, 2);
  end if;

  if s.fee_mode = 'zone' then
    select * into v_zone from delivery_zones
      where restaurant_id = v_rid and postal_code = trim(coalesce(p_postal_code, '')) and active;
    if not found then
      return query select false, 'Cette adresse est hors de notre zone de livraison.', v_dist, 0::numeric, v_min, s.estimated_minutes;
      return;
    end if;
    v_fee := v_zone.fee;
    v_min := coalesce(v_zone.min_order, s.min_order);

  elsif s.fee_mode = 'flat' then
    if v_dist is null then
      return query select false, 'Adresse non localisée, impossible de vérifier la zone.', null::numeric, 0::numeric, v_min, s.estimated_minutes;
      return;
    end if;
    if v_dist > s.max_radius_km then
      return query select false, 'Cette adresse est hors de notre zone de livraison.', v_dist, 0::numeric, v_min, s.estimated_minutes;
      return;
    end if;
    v_fee := s.flat_fee;

  else -- 'distance'
    if v_dist is null then
      return query select false, 'Adresse non localisée, impossible de calculer la livraison.', null::numeric, 0::numeric, v_min, s.estimated_minutes;
      return;
    end if;
    if v_dist > s.max_radius_km then
      return query select false, 'Cette adresse est hors de notre zone de livraison.', v_dist, 0::numeric, v_min, s.estimated_minutes;
      return;
    end if;
    if s.distance_pricing = 'per_km' then
      v_fee := round(s.per_km_base + s.per_km_rate * v_dist, 2);
    else
      select t.fee into v_fee from delivery_fee_tiers t
        where t.restaurant_id = v_rid and t.up_to_km >= v_dist
        order by t.up_to_km asc limit 1;
      if not found then
        return query select false, 'Cette adresse est hors de notre zone de livraison.', v_dist, 0::numeric, v_min, s.estimated_minutes;
        return;
      end if;
    end if;
  end if;

  -- Livraison offerte à partir d'un certain montant (optionnel).
  if s.free_delivery_from is not null and coalesce(p_subtotal, 0) >= s.free_delivery_from then
    v_fee := 0;
  end if;

  return query select true, null::text, v_dist, v_fee, v_min, s.estimated_minutes;
end;
$func$;

grant execute on function compute_delivery_quote(double precision, double precision, text, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Création d'une commande en livraison (atomique : commande +
--    engagement CGV). Revalide l'éligibilité, le minimum et les frais.
--    L'IP et le user-agent arrivent de la Route Handler serveur.
-- ---------------------------------------------------------------------
create or replace function create_delivery_order(
  p_items jsonb,
  p_service_type text,
  p_name text,
  p_slot_allocations jsonb,
  p_pizza_count integer,
  p_subtotal numeric,
  p_customer_phone text,
  p_delivery_address text,
  p_delivery_postal_code text,
  p_delivery_city text,
  p_delivery_lat double precision,
  p_delivery_lng double precision,
  p_delivery_instructions text,
  p_cgv_text_snapshot text,
  p_cgv_version text,
  p_ip_address text,
  p_user_agent text default null
)
returns table (order_id uuid, takeaway_number integer, delivery_fee numeric, total numeric)
language plpgsql
security invoker
set search_path = public
as $func$
declare
  v_rid text := my_restaurant_id();
  v_quote record;
  v_num integer;
  v_order_id uuid;
  v_total numeric;
begin
  if coalesce(trim(p_delivery_address), '') = '' then
    raise exception 'Adresse de livraison requise';
  end if;

  select * into v_quote
  from compute_delivery_quote(p_delivery_lat, p_delivery_lng, p_delivery_postal_code, p_subtotal);

  if not v_quote.deliverable then
    raise exception '%', coalesce(v_quote.reason, 'Livraison impossible pour cette adresse.');
  end if;
  if coalesce(p_subtotal, 0) < v_quote.min_order then
    raise exception 'Minimum de commande pour la livraison : % €', v_quote.min_order;
  end if;

  v_num := next_takeaway_number();
  v_total := coalesce(p_subtotal, 0) + v_quote.fee;

  insert into orders (
    restaurant_id, items, service_type, name, slot_allocations, pizza_count,
    total, status, takeaway_number,
    delivery_address, delivery_postal_code, delivery_city,
    delivery_lat, delivery_lng, delivery_distance_km, delivery_fee,
    delivery_instructions, delivery_phone, delivery_status
  )
  values (
    v_rid, p_items, p_service_type, p_name,
    coalesce(p_slot_allocations, '[]'::jsonb), coalesce(p_pizza_count, 0),
    v_total, 'attente', v_num,
    left(trim(p_delivery_address), 300), left(trim(coalesce(p_delivery_postal_code, '')), 10),
    left(trim(coalesce(p_delivery_city, '')), 120),
    p_delivery_lat, p_delivery_lng, v_quote.distance_km, v_quote.fee,
    nullif(left(trim(coalesce(p_delivery_instructions, '')), 300), ''), p_customer_phone, 'a_livrer'
  )
  returning id into v_order_id;

  insert into order_commitments (
    order_id, restaurant_id, customer_phone, customer_name,
    commitment_accepted, commitment_accepted_at,
    cgv_text_snapshot, cgv_version, ip_address, user_agent, order_status
  )
  values (
    v_order_id, v_rid, p_customer_phone,
    case when nullif(trim(p_name), '') is null or trim(p_name) = 'Commande en ligne' then null else left(trim(p_name), 120) end,
    true, now(), p_cgv_text_snapshot, p_cgv_version, p_ip_address, p_user_agent, 'pending'
  );

  -- Fidélité : points sur le sous-total articles (hors frais de livraison).
  -- Jamais bloquant, comme pour le click & collect.
  begin
    perform award_loyalty_points(p_customer_phone, coalesce(p_subtotal, 0), v_order_id, 'click_and_collect', v_rid);
  exception when others then
    null;
  end;

  order_id := v_order_id;
  takeaway_number := v_num;
  delivery_fee := v_quote.fee;
  total := v_total;
  return next;
end;
$func$;

grant execute on function create_delivery_order(
  jsonb, text, text, jsonb, integer, numeric, text,
  text, text, text, double precision, double precision, text,
  text, text, text, text
) to authenticated;

notify pgrst, 'reload schema';
