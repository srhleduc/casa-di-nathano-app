-- Créneaux /reserver : délai minimum entre « maintenant » et le premier créneau
-- réservable (réglable, remplace le 30 min codé en dur dans buildCandidateSlots).
-- + Clarification des bornes earliest/latest : elles ne servent qu'à l'extension
--   automatique de service, pas au calcul des créneaux. Valeurs de test
--   remises sur l'amplitude réelle pour Quimperlé (12h → 22h30).
--
-- À coller dans Supabase → SQL Editor. Une instruction par ligne.

alter table reservation_settings add column if not exists booking_lead_minutes int not null default 30;
alter table reservation_settings alter column earliest_service_time set default '12:00';
update reservation_settings set earliest_service_time = '12:00', latest_service_time = '22:30' where restaurant_id = 'quimperle';

notify pgrst, 'reload schema';
