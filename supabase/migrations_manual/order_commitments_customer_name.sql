-- Conserve le NOM donné par le client avec la preuve d'engagement (anti no-show).
--
-- Problème : le nom saisi sur /commande n'est stocké que dans orders.name. Le cron
-- quotidien 'casa-di-nathano-daily-reset' (04:00) supprime les commandes des jours
-- passés ; order_commitments survit (24 mois, voir order_commitments_retention.sql)
-- mais sans nom : on retrouve le téléphone, l'IP et l'heure, pas le nom.
--
-- Fix : colonne order_commitments.customer_name, remplie à la création de la
-- commande par create_takeaway_order (même signature qu'avant : p_name est déjà
-- envoyé par /api/commande, donc aucun changement de code côté appli).
-- Le libellé par défaut « Commande en ligne » (client sans nom) n'est pas un nom :
-- il est stocké à NULL.
--
-- Ne rattrape pas les commandes déjà purgées. Les engagements dont la commande
-- existe encore sont complétés ci-dessous.
--
-- Rejouable (if not exists / or replace).

alter table order_commitments add column if not exists customer_name text;

update order_commitments c
set customer_name = nullif(trim(o.name), '')
from orders o
where c.order_id = o.id
  and c.customer_name is null
  and nullif(trim(o.name), '') is not null
  and trim(o.name) <> 'Commande en ligne';

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
    perform award_loyalty_points(p_customer_phone, coalesce(p_total, 0), v_order_id, 'click_and_collect', v_rid);
  exception when others then
    null;
  end;

  order_id := v_order_id;
  takeaway_number := v_num;
  return next;
end;
$func$;

notify pgrst, 'reload schema';
