-- =====================================================================
-- BON DE RÉDUCTION RATTACHÉ À UN NUMÉRO DE TÉLÉPHONE (geste commercial)
--
-- Cas d'usage : erreur sur une commande, client mécontent -> la Direction /
-- l'équipe offre un bon en saisissant simplement le numéro du client. À sa
-- prochaine commande (click & collect ou livraison), le serveur retrouve le
-- bon par le téléphone, déduit le montant du total, passe le bon en
-- 'utilise' et garde la trace sur la commande (voucher_*), ce qui permet
-- d'afficher un bandeau bien visible sur la vignette équipe.
--
-- Périmètre : uniquement les bons reason = 'manuel' (geste commercial).
-- Les bons automatiques (palier_150, anniversaire) restent utilisés en caisse
-- comme avant, rien ne change pour eux.
--
-- Additif : nouvelles colonnes nullables, nouvelles fonctions, et les deux
-- fonctions de commande gardent exactement leur signature (la logique bon
-- n'agit que si un bon actif existe pour le numéro).
-- =====================================================================

alter table promo_codes add column if not exists note text;

alter table orders
  add column if not exists voucher_code text,
  add column if not exists voucher_amount numeric(10, 2),
  add column if not exists voucher_note text;

-- ------------------------------------------------------ normalize_phone_fr --
-- Même normalisation que award_loyalty_points / resolve_loyalty_wallet_by_phone.
create or replace function normalize_phone_fr(p_phone text)
returns text
language plpgsql
immutable
set search_path = public
as $body$
declare
  v text := regexp_replace(coalesce(p_phone, ''), '[\s.\-()]', '', 'g');
begin
  if v like '+33%' then v := '0' || substr(v, 4);
  elsif v like '0033%' then v := '0' || substr(v, 5);
  elsif v like '+590%' then v := '0' || substr(v, 5);
  elsif v like '+594%' then v := '0' || substr(v, 5);
  end if;
  if v !~ '^0[1-9][0-9]{8}$' then return null; end if;
  return v;
end;
$body$;

-- ------------------------------------------------------ create_phone_voucher --
-- Crée le bon à partir d'un numéro (le compte fidélité est créé s'il n'existe
-- pas encore). Montant libre, motif interne (jamais montré au client).
create or replace function create_phone_voucher(
  p_phone text,
  p_reduction numeric,
  p_note text default null,
  p_days integer default 30
)
returns table (voucher_id uuid, voucher_code text, voucher_customer_id uuid, voucher_expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_phone text := normalize_phone_fr(p_phone);
  v_customer uuid;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_id uuid;
  v_exp timestamptz;
  k integer;
begin
  if v_phone is null then
    raise exception 'Numéro de téléphone invalide';
  end if;
  if p_reduction is null or p_reduction <= 0 or p_reduction > 200 then
    raise exception 'Montant du bon invalide';
  end if;

  insert into loyalty_customers (phone) values (v_phone) on conflict (phone) do nothing;
  select lc.id into v_customer from loyalty_customers lc where lc.phone = v_phone;

  for k in 1 .. 5 loop
    v_code := 'CASA-' || (
      select string_agg(substr(v_alphabet, 1 + floor(random() * 32)::integer, 1), '')
      from generate_series(1, 6)
    );
    begin
      insert into promo_codes (code, customer_id, reduction, reason, status, expires_at, note)
      values (
        v_code, v_customer, round(p_reduction, 2), 'manuel', 'actif',
        now() + make_interval(days => greatest(coalesce(p_days, 30), 1)),
        nullif(left(trim(coalesce(p_note, '')), 200), '')
      )
      returning promo_codes.id, promo_codes.expires_at into v_id, v_exp;
      voucher_id := v_id;
      voucher_code := v_code;
      voucher_customer_id := v_customer;
      voucher_expires_at := v_exp;
      return next;
      return;
    exception when unique_violation then
      null; -- collision sur le code : on retente
    end;
  end loop;
  raise exception 'Impossible de générer un code unique';
end;
$body$;

-- --------------------------------------------------------- find_phone_voucher --
-- Aperçu côté client (écran de commande) : un bon actif existe-t-il pour ce
-- numéro ? Ne renvoie QUE le montant et l'échéance (jamais le motif interne).
-- Rate-limité par IP avec la table de /mon-compte (loyalty_public_lookups).
create or replace function find_phone_voucher(p_phone text, p_ip text default null)
returns table (voucher_code text, voucher_reduction numeric, voucher_expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_phone text := normalize_phone_fr(p_phone);
  v_ip text := nullif(btrim(coalesce(p_ip, '')), '');
  v_recent integer;
begin
  if v_phone is null then return; end if;
  if v_ip is not null and v_ip ~ '^[0-9A-Fa-f:.]{3,45}$' then
    select count(*) into v_recent from loyalty_public_lookups
      where ip = v_ip and at > now() - interval '10 minutes';
    insert into loyalty_public_lookups (ip) values (v_ip);
    if v_recent >= 40 then return; end if;
  end if;
  return query
    select pc.code, pc.reduction, pc.expires_at
    from promo_codes pc
    join loyalty_customers lc on lc.id = pc.customer_id
    where lc.phone = v_phone and pc.reason = 'manuel' and pc.status = 'actif' and pc.expires_at > now()
    order by pc.expires_at asc
    limit 1;
end;
$body$;

-- --------------------------------------------------------- claim_phone_voucher --
-- Consomme le bon (atomique, skip locked : jamais deux commandes pour un même
-- bon). Appelé UNIQUEMENT par les fonctions de commande, dans leur transaction :
-- si la commande échoue, le bon est automatiquement rendu.
create or replace function claim_phone_voucher(p_phone text, p_subtotal numeric)
returns table (voucher_id uuid, voucher_code text, applied numeric, voucher_note text)
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_phone text := normalize_phone_fr(p_phone);
  v_id uuid;
  v_code text;
  v_red numeric;
  v_note text;
begin
  if v_phone is null or coalesce(p_subtotal, 0) <= 0 then return; end if;

  select pc.id into v_id
  from promo_codes pc
  join loyalty_customers lc on lc.id = pc.customer_id
  where lc.phone = v_phone and pc.reason = 'manuel' and pc.status = 'actif' and pc.expires_at > now()
  order by pc.expires_at asc
  limit 1
  for update of pc skip locked;

  if v_id is null then return; end if;

  update promo_codes set status = 'utilise' where id = v_id
  returning code, reduction, note into v_code, v_red, v_note;

  voucher_id := v_id;
  voucher_code := v_code;
  applied := least(v_red, p_subtotal);
  voucher_note := v_note;
  return next;
end;
$body$;

revoke execute on function normalize_phone_fr(text) from public, anon;
revoke execute on function create_phone_voucher(text, numeric, text, integer) from public, anon;
revoke execute on function find_phone_voucher(text, text) from public, anon;
revoke execute on function claim_phone_voucher(text, numeric) from public, anon;
grant execute on function normalize_phone_fr(text) to authenticated;
grant execute on function create_phone_voucher(text, numeric, text, integer) to authenticated;
grant execute on function find_phone_voucher(text, text) to authenticated;
grant execute on function claim_phone_voucher(text, numeric) to authenticated;

-- ------------------------------------------------------- create_takeaway_order --
-- Identique à la version en base, plus : déduction du bon téléphone, trace
-- sur la commande, points de fidélité calculés sur le montant réellement dû.
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
  p_ip_address text,
  p_user_agent text default null
)
returns table (order_id uuid, takeaway_number integer)
language plpgsql
set search_path = public
as $func$
declare
  v_rid text := my_restaurant_id();
  v_num integer := next_takeaway_number();
  v_order_id uuid;
  v_total numeric := coalesce(p_total, 0);
  v_v record;
begin
  select * into v_v from claim_phone_voucher(p_customer_phone, v_total);
  if v_v.voucher_id is not null then
    v_total := v_total - v_v.applied;
  end if;

  insert into orders (
    restaurant_id, items, service_type, name, slot_allocations,
    pizza_count, total, status, takeaway_number,
    voucher_code, voucher_amount, voucher_note
  )
  values (
    v_rid, p_items, p_service_type, p_name, coalesce(p_slot_allocations, '[]'::jsonb),
    coalesce(p_pizza_count, 0), v_total, 'attente', v_num,
    v_v.voucher_code, v_v.applied, v_v.voucher_note
  )
  returning id into v_order_id;

  insert into order_commitments (
    order_id, restaurant_id, customer_phone, customer_name, commitment_accepted, commitment_accepted_at,
    cgv_text_snapshot, cgv_version, ip_address, user_agent, order_status
  )
  values (
    v_order_id, v_rid, p_customer_phone,
    case when nullif(trim(p_name), '') is null or trim(p_name) = 'Commande en ligne' then null else left(trim(p_name), 120) end,
    true, now(),
    p_cgv_text_snapshot, p_cgv_version, p_ip_address, p_user_agent, 'pending'
  );

  begin
    perform award_loyalty_points(p_customer_phone, v_total, v_order_id, 'click_and_collect', v_rid);
  exception when others then
    null;
  end;

  order_id := v_order_id;
  takeaway_number := v_num;
  return next;
end;
$func$;

-- ------------------------------------------------------- create_delivery_order --
-- Identique à la version en base, plus : bon déduit du sous-total (jamais des
-- frais de livraison), sauf en mode test livraison (is_test) où le bon n'est
-- pas consommé.
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
set search_path = public
as $function$
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
  v_v record;
  v_sub numeric;
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

  select not coalesce(enabled, false), coalesce(waves_enabled, false)
    into v_is_test, v_waves_enabled
  from delivery_settings where restaurant_id = v_rid;
  v_is_test := coalesce(v_is_test, false);
  v_waves_enabled := coalesce(v_waves_enabled, false);

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
  v_sub := coalesce(p_subtotal, 0);

  -- Mode test : téléphone nul => aucun bon consommé (v_v reste à NULL).
  select * into v_v from claim_phone_voucher(case when v_is_test then null else p_customer_phone end, v_sub);
  if v_v.voucher_id is not null then
    v_sub := v_sub - v_v.applied;
  end if;
  v_total := v_sub + v_quote.fee;

  insert into orders (
    restaurant_id, items, service_type, name, slot_allocations, pizza_count,
    total, status, takeaway_number,
    delivery_address, delivery_postal_code, delivery_city,
    delivery_lat, delivery_lng, delivery_distance_km, delivery_fee,
    delivery_instructions, delivery_phone, delivery_status, is_test,
    delivery_wave, delivery_sector,
    voucher_code, voucher_amount, voucher_note
  )
  values (
    v_rid, p_items, p_service_type, p_name,
    coalesce(p_slot_allocations, '[]'::jsonb), coalesce(p_pizza_count, 0),
    v_total, 'attente', v_num,
    left(trim(p_delivery_address), 300), left(trim(coalesce(p_delivery_postal_code, '')), 10),
    left(trim(coalesce(p_delivery_city, '')), 120),
    p_delivery_lat, p_delivery_lng, v_quote.distance_km, v_quote.fee,
    nullif(left(trim(coalesce(p_delivery_instructions, '')), 300), ''), p_customer_phone, 'a_livrer', v_is_test,
    v_wave_time, v_wave_sector,
    v_v.voucher_code, v_v.applied, v_v.voucher_note
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

  begin
    if not v_is_test then
      perform award_loyalty_points(p_customer_phone, v_sub, v_order_id, 'click_and_collect', v_rid);
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
$function$;
