-- =====================================================================
-- MODULE POINTAGE — ajout du type de pointage sur les régularisations
-- pointage_corrections existe depuis la phase 1 mais n'a jamais eu de
-- colonne `type` (aucun écran ne l'utilisait encore) — nécessaire pour
-- savoir si une régularisation concerne une arrivée, une pause ou un
-- départ, notamment quand elle ajoute un pointage manquant (pas de
-- original_entry_id à partir duquel le déduire).
--
-- Table encore vide en production : ajout NOT NULL direct, sans risque.
-- À exécuter une fois dans Supabase → SQL Editor.
-- =====================================================================

alter table pointage_corrections
  add column if not exists type pointage_type not null;

notify pgrst, 'reload schema';
