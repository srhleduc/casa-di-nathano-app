-- =====================================================================
-- FIDÉLITÉ — SMS "avis Google" après 3 passages, avec détection de
-- l'établissement du 3e passage (base fidélité partagée Riec/Quimperlé,
-- mais chaque MOUVEMENT de points sait désormais dans quel restaurant il
-- a eu lieu). À exécuter une fois dans Supabase → SQL Editor.
-- =====================================================================

-- Lien d'avis Google par établissement, éditable dans Direction → Messages
-- fidélité (nouveau champ, pas de valeur par défaut — à renseigner).
alter table restaurants add column if not exists google_review_url text;

drop policy if exists "restaurants_manager_write" on restaurants;
create policy "restaurants_manager_write" on restaurants for update to authenticated using (is_manager()) with check (is_manager());

-- Nombre de passages "réels" (source non nulle : caisse ou click & collect,
-- pas un ajout de points manuel) — sert uniquement à déclencher le SMS au
-- 3e passage, une seule fois.
alter table loyalty_customers add column if not exists visits integer not null default 0;

-- Établissement où CE mouvement a eu lieu — permet de savoir, au moment où
-- le compteur de passages atteint 3, dans quel restaurant c'était.
alter table loyalty_movements add column if not exists restaurant_id text references restaurants (id);

alter table loyalty_messages drop constraint if exists loyalty_messages_type_check;
alter table loyalty_messages add constraint loyalty_messages_type_check
  check (type in ('anniversaire', 'recompense', 'promo', 'bienvenue', 'avis_google'));

-- award_loyalty_points gagne un 5e paramètre optionnel p_restaurant_id (les
-- appelants existants qui ne le passent pas gardent leur comportement :
-- restaurant_id nul sur le mouvement, pas de compteur de passage rattachable
-- à un établissement pour cet appel). Signature élargie : on retire l'ancien
-- overload à 4 arguments pour éviter toute ambiguïté de résolution.
drop function if exists award_loyalty_points(text, numeric, uuid, text);

create or replace function award_loyalty_points(
  p_phone text,
  p_amount numeric,
  p_order_id uuid,
  p_source text,
  p_restaurant_id text default null
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
    update loyalty_customers set last_activity_at = now() where id = v_customer_id
      returning solde_points into v_new_solde;
    return v_new_solde;
  end if;

  update loyalty_customers
  set solde_points = solde_points + v_points,
      last_activity_at = now(),
      -- Un "passage" = un gain avec une provenance réelle (caisse / click &
      -- collect), pas un ajout de points manuel (p_source alors nul).
      visits = visits + (case when p_source is not null then 1 else 0 end)
  where id = v_customer_id;

  insert into loyalty_movements (customer_id, type, points, order_id, source, restaurant_id)
  values (v_customer_id, 'gain', v_points, p_order_id, p_source, p_restaurant_id);

  select solde_points into v_new_solde from loyalty_customers where id = v_customer_id;
  return v_new_solde;
end;
$award$;

grant execute on function award_loyalty_points(text, numeric, uuid, text, text) to authenticated;

-- create_takeaway_order (click & collect) passe désormais son propre
-- restaurant_id (v_rid, déjà résolu par my_restaurant_id() plus haut dans la
-- fonction) à award_loyalty_points. Signature inchangée, juste le corps.
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
    restaurant_id, items, service_type, name, slot_allocations,
    pizza_count, total, status, takeaway_number
  )
  values (
    v_rid, p_items, p_service_type, p_name, coalesce(p_slot_allocations, '[]'::jsonb),
    coalesce(p_pizza_count, 0), coalesce(p_total, 0), 'attente', v_num
  )
  returning id into v_order_id;

  insert into order_commitments (
    order_id, restaurant_id, customer_phone, commitment_accepted, commitment_accepted_at,
    cgv_text_snapshot, cgv_version, ip_address, order_status
  )
  values (
    v_order_id, v_rid, p_customer_phone, true, now(),
    p_cgv_text_snapshot, p_cgv_version, p_ip_address, 'pending'
  );

  begin
    perform award_loyalty_points(p_customer_phone, coalesce(p_total, 0), v_order_id, 'click_and_collect', v_rid);
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

-- Déclenche le SMS "avis Google" au moment précis où un mouvement fait
-- passer le compteur de visites à 3 (jamais au-delà : pas de relance).
-- AFTER INSERT sur loyalty_movements (comme le trigger palier 150) : le
-- compteur de visits est déjà à jour (mis à jour AVANT l'insert du
-- mouvement, même ordre que solde_points) et new.restaurant_id porte
-- l'établissement de CE passage précis.
create or replace function loyalty_visit_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $visit$
declare
  v_visits integer;
begin
  select visits into v_visits from loyalty_customers where id = new.customer_id;
  if v_visits = 3 then
    perform net.http_post(
      url := 'https://tvuqyrkomuwlapevgekv.functions.supabase.co/loyalty-sms',
      body := jsonb_build_object('event', 'avis_google', 'id', new.customer_id, 'restaurant_id', new.restaurant_id),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end if;
  return null;
end;
$visit$;

drop trigger if exists loyalty_visit_avis_google on loyalty_movements;
create trigger loyalty_visit_avis_google
after insert on loyalty_movements
for each row
when (new.type = 'gain' and new.source is not null)
execute function loyalty_visit_notify();

notify pgrst, 'reload schema';
