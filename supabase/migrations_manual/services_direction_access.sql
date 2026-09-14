-- Autorise l'espace Direction à éditer les services (horaires/jours de
-- fermeture par établissement) — jusqu'ici en lecture seule (via is_manager()
-- déjà présent sur les policies *_select), l'écriture était réservée au
-- compte fixe de chaque restaurant. Voir components/direction/ServicesDirectionAdmin.jsx.

drop policy if exists "service_templates_write" on service_templates;
create policy "service_templates_write" on service_templates for all to authenticated
  using (restaurant_id = my_restaurant_id() or is_manager())
  with check (restaurant_id = my_restaurant_id() or is_manager());

drop policy if exists "service_overrides_write" on service_overrides;
create policy "service_overrides_write" on service_overrides for all to authenticated
  using (restaurant_id = my_restaurant_id() or is_manager())
  with check (restaurant_id = my_restaurant_id() or is_manager());

drop policy if exists "service_exceptions_write" on service_exceptions;
create policy "service_exceptions_write" on service_exceptions for all to authenticated
  using (restaurant_id = my_restaurant_id() or is_manager())
  with check (restaurant_id = my_restaurant_id() or is_manager());

drop policy if exists "reservation_settings_write" on reservation_settings;
create policy "reservation_settings_write" on reservation_settings for all to authenticated
  using (restaurant_id = my_restaurant_id() or is_manager())
  with check (restaurant_id = my_restaurant_id() or is_manager());
