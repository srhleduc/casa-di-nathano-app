-- Plafond de couverts pour la réservation en ligne (en plus du blocage total).
-- Dans online_booking_closures (voir online_booking_closures.sql) :
--   max_covers NULL     = service bloqué à la réservation en ligne
--   max_covers = N      = la réservation en ligne reste ouverte tant que les couverts
--                         déjà réservés (tout sauf annulé / no-show) + le nouveau
--                         groupe ne dépassent pas N. N = réservés au moment du clic + « encore X ».
-- À coller dans Supabase → SQL Editor. À exécuter AVANT de déployer le code.

alter table online_booking_closures add column if not exists max_covers int check (max_covers >= 0);

create or replace function check_online_booking_open() returns trigger language plpgsql as $$
declare
  c record;
  booked int;
begin
  if new.source <> 'client' then
    return new;
  end if;
  for c in
    select * from online_booking_closures x
    where x.restaurant_id = new.restaurant_id
      and x.date = (new.requested_at at time zone 'UTC')::date
      and (new.requested_at at time zone 'UTC')::time >= x.start_time
      and (new.requested_at at time zone 'UTC')::time < x.end_time
  loop
    if c.max_covers is null then
      raise exception 'online_booking_closed' using errcode = 'P0001';
    end if;
    select coalesce(sum(r.party_size), 0) into booked
    from reservations r
    where r.restaurant_id = new.restaurant_id
      and r.status not in ('cancelled', 'no_show')
      and (r.requested_at at time zone 'UTC')::date = c.date
      and (r.requested_at at time zone 'UTC')::time >= c.start_time
      and (r.requested_at at time zone 'UTC')::time < c.end_time;
    if booked + new.party_size > c.max_covers then
      raise exception 'online_booking_limit_reached' using errcode = 'P0001';
    end if;
  end loop;
  return new;
end;
$$;

notify pgrst, 'reload schema';
