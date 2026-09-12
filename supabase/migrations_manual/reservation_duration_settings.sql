-- =====================================================================
-- RÉSERVATION — durées estimées réglables (phase 9 : calage après un
-- service réel). Remplace les constantes codées en dur dans
-- estimateDurationMin() par des réglages par établissement, dans la
-- table reservation_settings existante. Valeurs par défaut = anciennes
-- constantes, aucun changement de comportement tant que rien n'est
-- modifié dans l'écran équipe.
--
-- À exécuter une fois dans Supabase → SQL Editor.
-- =====================================================================

alter table reservation_settings
  add column if not exists duration_min_1_2 int not null default 75;

alter table reservation_settings
  add column if not exists duration_min_3_4 int not null default 90;

alter table reservation_settings
  add column if not exists duration_min_5_6 int not null default 105;

alter table reservation_settings
  add column if not exists duration_min_extra_per_person int not null default 10;

notify pgrst, 'reload schema';
