-- App livreur : position GPS de départ des tournées (le restaurant).
-- À jouer APRÈS delivery_drivers.sql. Additif, sans risque, relançable.
--
-- Le livreur n'a pas le droit de lire delivery_settings (réservé au restaurant
-- et à la Direction). Cette fonction ne lui expose que la position GPS de
-- chaque restaurant, pour calculer l'ordre de ses livraisons.

create or replace function driver_delivery_origins()
returns table (restaurant_id text, lat double precision, lng double precision)
language plpgsql
stable
security definer
set search_path = public
as $func$
begin
  if not is_driver() then
    raise exception 'Accès livreur requis';
  end if;
  return query
  select s.restaurant_id, s.restaurant_lat, s.restaurant_lng
  from delivery_settings s
  where s.restaurant_lat is not null and s.restaurant_lng is not null;
end;
$func$;

grant execute on function driver_delivery_origins() to authenticated;

notify pgrst, 'reload schema';
