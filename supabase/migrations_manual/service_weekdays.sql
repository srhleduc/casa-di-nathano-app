-- Services de réservation : activation par jour de semaine.
-- Un service par défaut n'est plus « actif / inactif » globalement mais actif
-- sur un ensemble de jours de la semaine (ex. 2e service le week-end seulement).
-- Convention : 0 = dimanche … 6 = samedi (= Date.getDay() côté JS).
-- Additif, non cassant. Une instruction par ligne (éditeur SQL Supabase).

alter table service_templates add column if not exists active_weekdays int[] not null default '{0,1,2,3,4,5,6}';
update service_templates set active_weekdays = array[]::int[] where active_by_default = false and active_weekdays = '{0,1,2,3,4,5,6}';

notify pgrst, 'reload schema';
