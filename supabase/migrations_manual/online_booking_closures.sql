-- Blocage de la RÉSERVATION EN LIGNE pour un service précis d'une date
-- (ex. « samedi soir : complet, on ne prend plus de réservation sur /reserver »).
--
-- Différent d'une fermeture de service (service_overrides / service_exceptions) :
-- le service reste ACTIF côté équipe (board, ajout manuel, passages, click & collect)
-- — seule la prise de réservation par les clients sur /reserver est coupée.
--
-- Une ligne = un service bloqué pour une date. On garde une copie des horaires du
-- service (start_time / end_time) au moment du blocage pour que le contrôle côté base
-- (trigger ci-dessous) n'ait pas à recalculer les services du jour.
--
-- À coller dans Supabase → SQL Editor. Purement additif.

create table if not exists online_booking_closures (id uuid primary key default gen_random_uuid(), restaurant_id text not null references restaurants (id), date date not null, service_number int not null, start_time time not null, end_time time not null, created_at timestamptz not null default now(), unique (restaurant_id, date, service_number));

alter table online_booking_closures enable row level security;
drop policy if exists "online_booking_closures_select" on online_booking_closures;
drop policy if exists "online_booking_closures_write" on online_booking_closures;
create policy "online_booking_closures_select" on online_booking_closures for select to authenticated using (restaurant_id = my_restaurant_id() or is_manager());
create policy "online_booking_closures_write" on online_booking_closures for all to authenticated using (restaurant_id = my_restaurant_id() or is_manager()) with check (restaurant_id = my_restaurant_id() or is_manager());

alter publication supabase_realtime add table online_booking_closures;

-- ---- Garde-fou côté base -------------------------------------------------
-- Une réservation créée depuis la page publique (source = 'client') est refusée si
-- son heure tombe dans un service bloqué ce jour-là. Protège aussi contre une page
-- /reserver restée ouverte avant le blocage. Les réservations équipe (walk_in, etc.)
-- ne sont jamais concernées. requested_at est stocké en « heure murale » (voir
-- buildRequestedAtISO) : on le relit donc en UTC, comme le fait l'appli.
create or replace function check_online_booking_open() returns trigger language plpgsql as $$
begin
  if new.source = 'client' and exists (
    select 1 from online_booking_closures c
    where c.restaurant_id = new.restaurant_id
      and c.date = (new.requested_at at time zone 'UTC')::date
      and (new.requested_at at time zone 'UTC')::time >= c.start_time
      and (new.requested_at at time zone 'UTC')::time < c.end_time
  ) then
    raise exception 'online_booking_closed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_check_online_booking_open on reservations;
create trigger reservations_check_online_booking_open before insert on reservations for each row execute function check_online_booking_open();

notify pgrst, 'reload schema';
