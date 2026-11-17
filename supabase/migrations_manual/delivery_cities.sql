-- =====================================================================
-- LIVRAISON — villes desservies (mode « selon la distance »)
--
-- À jouer APRÈS delivery.sql. Additif, non cassant : tant qu'un restaurant
-- n'a aucune ligne dans delivery_cities, la livraison au kilomètre
-- fonctionne comme avant (rayon maximum seulement).
--
-- Dès qu'un restaurant a une liste de villes (onglet Direction → Livraison),
-- en mode « selon la distance » :
--   - une ville absente de la liste, ou en mode 'off'  → on ne livre pas ;
--   - 'all'    : toute la ville est livrée, même au-delà du rayon maximum ;
--   - 'radius' : la ville est livrée jusqu'à radius_km du restaurant
--                (pour les grandes communes).
-- La distance reste calculée à vol d'oiseau depuis le restaurant.
-- Au-delà de la dernière tranche de tarif, une ville acceptée garde le tarif
-- de la dernière tranche.
--
-- La ville est identifiée par son code INSEE (celui renvoyé par le service
-- d'adresses), pas par le code postal : plusieurs communes peuvent partager
-- un code postal.
-- =====================================================================

create table if not exists delivery_cities (
  restaurant_id text not null references restaurants (id) on delete cascade,
  insee_code text not null,            -- code INSEE de la commune, ex. "29236"
  label text not null,                 -- ex. "Riec-sur-Bélon"
  postal_codes text,                   -- affichage seulement, ex. "29340"
  mode text not null default 'all' check (mode in ('all', 'radius', 'off')),
  radius_km numeric(5, 2) check (radius_km is null or radius_km > 0),
  primary key (restaurant_id, insee_code),
  check (mode <> 'radius' or radius_km is not null)
);

alter table delivery_cities enable row level security;

drop policy if exists "delivery_cities_read" on delivery_cities;
create policy "delivery_cities_read" on delivery_cities for select to authenticated
  using (restaurant_id = my_restaurant_id() or is_manager());
drop policy if exists "delivery_cities_manager_write" on delivery_cities;
create policy "delivery_cities_manager_write" on delivery_cities for all to authenticated
  using (is_manager()) with check (is_manager());

-- ---------------------------------------------------------------------
-- Devis : nouvelle version avec le code INSEE de la ville (facultatif).
-- On retire l'ancienne signature (4 paramètres) pour éviter toute ambiguïté
-- d'appel ; les anciens appels sans code INSEE restent valides.
-- ---------------------------------------------------------------------
drop function if exists compute_delivery_quote(double precision, double precision, text, numeric);

create or replace function compute_delivery_quote(
  p_lat double precision,
  p_lng double precision,
  p_postal_code text,
  p_subtotal numeric,
  p_citycode text default null
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
  v_city delivery_cities%rowtype;
  v_city_rule boolean := false;
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

    -- Liste de villes configurée ? (et code INSEE connu)
    if p_citycode is not null and exists (select 1 from delivery_cities c where c.restaurant_id = v_rid) then
      v_city_rule := true;
      select * into v_city from delivery_cities
        where restaurant_id = v_rid and insee_code = trim(p_citycode);
      if not found or v_city.mode = 'off' then
        return query select false, 'Nous ne livrons pas dans cette commune.', v_dist, 0::numeric, v_min, s.estimated_minutes;
        return;
      end if;
      if v_city.mode = 'radius' and v_dist > v_city.radius_km then
        return query select false, 'Cette adresse est trop éloignée pour être livrée.', v_dist, 0::numeric, v_min, s.estimated_minutes;
        return;
      end if;
      -- mode 'all' : pas de limite de rayon pour cette ville.
    elsif v_dist > s.max_radius_km then
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
        -- Au-delà de la dernière tranche : une ville acceptée garde le tarif de la dernière tranche.
        if v_city_rule then
          select t.fee into v_fee from delivery_fee_tiers t
            where t.restaurant_id = v_rid
            order by t.up_to_km desc limit 1;
        end if;
        if not found then
          return query select false, 'Cette adresse est hors de notre zone de livraison.', v_dist, 0::numeric, v_min, s.estimated_minutes;
          return;
        end if;
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

grant execute on function compute_delivery_quote(double precision, double precision, text, numeric, text) to authenticated;

-- ---------------------------------------------------------------------
-- Création de commande : même fonction qu'avant + code INSEE (facultatif).
-- ---------------------------------------------------------------------
drop function if exists create_delivery_order(
  jsonb, text, text, jsonb, integer, numeric, text,
  text, text, text, double precision, double precision, text,
  text, text, text, text
);

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
  p_user_agent text default null,
  p_delivery_citycode text default null
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
  from compute_delivery_quote(p_delivery_lat, p_delivery_lng, p_delivery_postal_code, p_subtotal, p_delivery_citycode);

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
  text, text, text, text, text
) to authenticated;

notify pgrst, 'reload schema';
