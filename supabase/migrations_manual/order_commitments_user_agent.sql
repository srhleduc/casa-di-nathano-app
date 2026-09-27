-- =====================================================================
-- Capture du User-Agent à la commande en ligne (click & collect), en
-- complément de l'IP déjà stockée dans order_commitments.ip_address.
--
-- Objectif : garder une trace technique minime et non intrusive
-- (navigateur / OS / type d'appareil déclarés par le navigateur lui-même,
-- comme n'importe quel serveur web le reçoit) pour documenter les
-- commandes non retirées (no-show), sans mettre en place de
-- fingerprinting avancé ni de cookie de suivi. Base légale : intérêt
-- légitime (prévention de la fraude / des no-shows), même fondement que
-- l'IP déjà collectée. À exécuter une fois dans Supabase → SQL Editor.
-- =====================================================================

alter table order_commitments add column if not exists user_agent text;

-- create_takeaway_order gagne un 11e paramètre optionnel p_user_agent.
-- Corps repris À L'IDENTIQUE de la version en production (award_loyalty_points
-- appelé avec v_rid, cf. loyalty_avis_google.sql) — on ajoute uniquement la
-- capture du user-agent, rien d'autre ne change.
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
    order_id, restaurant_id, customer_phone, commitment_accepted, commitment_accepted_at,
    cgv_text_snapshot, cgv_version, ip_address, user_agent, order_status
  )
  values (
    v_order_id, v_rid, p_customer_phone, true, now(),
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

grant execute on function create_takeaway_order(
  jsonb, text, text, jsonb, integer, numeric,
  text, text, text, text, text
) to authenticated;

notify pgrst, 'reload schema';
