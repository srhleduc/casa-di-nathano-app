-- =====================================================================
-- LIVRAISON — départs groupés par secteur, avec quota par départ
--
-- À jouer APRÈS delivery.sql, delivery_cities.sql et delivery_test_mode.sql.
-- Additif, non cassant : tant que delivery_settings.waves_enabled reste à
-- false, la livraison fonctionne exactement comme avant (créneau four libre,
-- aucune limite de commandes par départ).
--
-- Pourquoi : un seul livreur. Plutôt que de livrer « à la demande », on fixe
-- des départs (ex. toutes les 30 min de 18h30 à 21h00), chacun dédié à UN
-- secteur (Est, Sud…) pour que la tournée soit une boucle, et on limite le
-- nombre de commandes par départ. Quand un départ est plein, il disparaît de
-- la liste proposée au client.
--
-- Ce que ça met en place :
--   1. delivery_settings.waves_enabled : interrupteur par restaurant.
--   2. delivery_cities.sector          : secteur d'une commune ('est' | 'sud').
--                                        NULL = commune « locale » (Riec) :
--                                        elle peut monter dans n'importe quel départ.
--   3. delivery_waves                  : les départs (heure, secteur, quota).
--   4. orders.delivery_wave / delivery_sector : départ choisi par le client.
--   5. delivery_wave_availability()    : départs encore disponibles pour une
--                                        commune, avec les places restantes.
--   6. create_delivery_order()         : revalide le départ CÔTÉ SERVEUR
--                                        (existe, bon secteur, pas complet),
--                                        sous verrou pour éviter qu'un
--                                        dernier créneau soit vendu deux fois.
--
-- Les heures de départ doivent correspondre à des créneaux four existants
-- (créneaux de 10 min générés depuis les horaires d'ouverture) : le départ
-- 19:00 est le créneau four 19:00, les pizzas sont donc prêtes à l'heure du
-- départ. Idempotent : peut être relancé.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 & 2. Interrupteur + secteur des communes
-- ---------------------------------------------------------------------
alter table delivery_settings add column if not exists waves_enabled boolean not null default false;

alter table delivery_cities add column if not exists sector text;
alter table delivery_cities drop constraint if exists delivery_cities_sector_check;
alter table delivery_cities add constraint delivery_cities_sector_check
  check (sector is null or sector in ('est', 'sud'));

-- ---------------------------------------------------------------------
-- 3. Les départs
-- ---------------------------------------------------------------------
create table if not exists delivery_waves (
  restaurant_id text not null references restaurants (id) on delete cascade,
  depart_time text not null check (depart_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  sector text not null check (sector in ('est', 'sud')),
  capacity integer not null default 4 check (capacity > 0),
  active boolean not null default true,
  primary key (restaurant_id, depart_time)
);

alter table delivery_waves enable row level security;

drop policy if exists "delivery_waves_read" on delivery_waves;
create policy "delivery_waves_read" on delivery_waves for select to authenticated
  using (restaurant_id = my_restaurant_id() or is_manager());
drop policy if exists "delivery_waves_manager_write" on delivery_waves;
create policy "delivery_waves_manager_write" on delivery_waves for all to authenticated
  using (is_manager()) with check (is_manager());

-- Départs de départ (modifiables ensuite en Direction → Livraison) :
-- toutes les 30 min de 18h30 à 21h00, Est et Sud en alternance, 4 commandes max.
insert into delivery_waves (restaurant_id, depart_time, sector, capacity)
select r.id, v.t, v.s, 4
from restaurants r
cross join (values
  ('18:30', 'est'), ('19:00', 'sud'), ('19:30', 'est'),
  ('20:00', 'sud'), ('20:30', 'est'), ('21:00', 'sud')
) as v (t, s)
where r.id = 'riec'
on conflict (restaurant_id, depart_time) do nothing;

-- ---------------------------------------------------------------------
-- 4. Départ choisi, sur la commande
-- ---------------------------------------------------------------------
alter table orders add column if not exists delivery_wave text;    -- ex. '19:00'
alter table orders add column if not exists delivery_sector text;  -- 'est' | 'sud'

create index if not exists orders_delivery_wave_idx on orders (restaurant_id, delivery_wave)
  where delivery_wave is not null;

-- ---------------------------------------------------------------------
-- 5. Départs disponibles pour une commune
--    security definer : le décompte doit compter TOUTES les commandes du
--    restaurant, pas seulement celles que le compte appelant peut lire.
--    On ne compte que les commandes des 18 dernières heures (les commandes
--    sont purgées chaque nuit ; c'est un garde-fou, pas une règle métier),
--    hors commandes annulées et hors commandes de test.
-- ---------------------------------------------------------------------
create or replace function delivery_wave_availability(p_citycode text default null)
returns table (
  depart_time text,
  sector text,
  capacity integer,
  used integer,
  remaining integer
)
language plpgsql
stable
security definer
set search_path = public
as $func$
declare
  v_rid text := my_restaurant_id();
  v_sector text := null;
begin
  if v_rid is null then
    return;
  end if;

  if p_citycode is not null then
    select c.sector into v_sector
    from delivery_cities c
    where c.restaurant_id = v_rid and c.insee_code = trim(p_citycode);
  end if;

  return query
  select
    w.depart_time,
    w.sector,
    w.capacity,
    coalesce(u.n, 0)::integer as used,
    greatest(w.capacity - coalesce(u.n, 0), 0)::integer as remaining
  from delivery_waves w
  left join lateral (
    select count(*) as n
    from orders o
    where o.restaurant_id = w.restaurant_id
      and o.delivery_wave = w.depart_time
      and o.delivery_status is not null
      and o.delivery_status <> 'annulee'
      and not o.is_test
      and o.created_at > now() - interval '18 hours'
  ) u on true
  where w.restaurant_id = v_rid
    and w.active
    and (v_sector is null or w.sector = v_sector)
  order by w.depart_time;
end;
$func$;

grant execute on function delivery_wave_availability(text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Création d'une commande en livraison, avec départ.
--    On remplace la fonction (nouvelle signature : + p_delivery_wave) ;
--    l'ancienne est supprimée pour éviter toute ambiguïté d'appel.
-- ---------------------------------------------------------------------
drop function if exists create_delivery_order(
  jsonb, text, text, jsonb, integer, numeric, text,
  text, text, text, double precision, double precision, text,
  text, text, text, text, text
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
  p_delivery_citycode text default null,
  p_delivery_wave text default null
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
  v_is_test boolean := false;
  v_waves_enabled boolean := false;
  v_wave delivery_waves%rowtype;
  v_city_sector text := null;
  v_used integer;
  v_wave_time text := null;
  v_wave_sector text := null;
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

  -- Mode test livraison : livraison désactivée mais Mode test équipe actif → commande de test.
  select not coalesce(enabled, false), coalesce(waves_enabled, false)
    into v_is_test, v_waves_enabled
  from delivery_settings where restaurant_id = v_rid;
  v_is_test := coalesce(v_is_test, false);
  v_waves_enabled := coalesce(v_waves_enabled, false);

  -- Départs groupés : le départ doit exister, desservir la commune du client
  -- et ne pas être complet. Verrou par départ : deux clients qui valident en
  -- même temps le dernier créneau sont traités l'un après l'autre.
  if v_waves_enabled then
    if coalesce(trim(p_delivery_wave), '') = '' then
      raise exception 'Choisissez un départ de livraison.';
    end if;

    select * into v_wave
    from delivery_waves
    where restaurant_id = v_rid and depart_time = trim(p_delivery_wave) and active;
    if not found then
      raise exception 'Ce départ de livraison n''est plus proposé — merci d''en choisir un autre.';
    end if;

    if p_delivery_citycode is not null then
      select c.sector into v_city_sector
      from delivery_cities c
      where c.restaurant_id = v_rid and c.insee_code = trim(p_delivery_citycode);
    end if;
    if v_city_sector is not null and v_city_sector <> v_wave.sector then
      raise exception 'Ce départ de livraison ne dessert pas votre commune — merci d''en choisir un autre.';
    end if;

    if not v_is_test then
      perform pg_advisory_xact_lock(hashtext(v_rid || ':wave:' || v_wave.depart_time));
      select count(*) into v_used
      from orders o
      where o.restaurant_id = v_rid
        and o.delivery_wave = v_wave.depart_time
        and o.delivery_status is not null
        and o.delivery_status <> 'annulee'
        and not o.is_test
        and o.created_at > now() - interval '18 hours';
      if v_used >= v_wave.capacity then
        raise exception 'Ce départ de livraison est complet — merci d''en choisir un autre.';
      end if;
    end if;

    v_wave_time := v_wave.depart_time;
    v_wave_sector := v_wave.sector;
  end if;

  v_num := next_takeaway_number();
  v_total := coalesce(p_subtotal, 0) + v_quote.fee;

  insert into orders (
    restaurant_id, items, service_type, name, slot_allocations, pizza_count,
    total, status, takeaway_number,
    delivery_address, delivery_postal_code, delivery_city,
    delivery_lat, delivery_lng, delivery_distance_km, delivery_fee,
    delivery_instructions, delivery_phone, delivery_status, is_test,
    delivery_wave, delivery_sector
  )
  values (
    v_rid, p_items, p_service_type, p_name,
    coalesce(p_slot_allocations, '[]'::jsonb), coalesce(p_pizza_count, 0),
    v_total, 'attente', v_num,
    left(trim(p_delivery_address), 300), left(trim(coalesce(p_delivery_postal_code, '')), 10),
    left(trim(coalesce(p_delivery_city, '')), 120),
    p_delivery_lat, p_delivery_lng, v_quote.distance_km, v_quote.fee,
    nullif(left(trim(coalesce(p_delivery_instructions, '')), 300), ''), p_customer_phone, 'a_livrer', v_is_test,
    v_wave_time, v_wave_sector
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
    if not v_is_test then
      perform award_loyalty_points(p_customer_phone, coalesce(p_subtotal, 0), v_order_id, 'click_and_collect', v_rid);
    end if;
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
  text, text, text, text, text, text
) to authenticated;

notify pgrst, 'reload schema';
