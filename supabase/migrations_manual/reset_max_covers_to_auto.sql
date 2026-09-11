-- =====================================================================
-- Couverts max par service/zone : bascule vers l'auto (capacité physique
-- des tables), voir lib/reservation/services.js applyAutoZoneCovers.
--
-- Les valeurs déjà en base ont été saisies sous l'ancien système, où le
-- champ était obligatoire et ne suivait pas forcément la vraie capacité de
-- chaque salle (c'est précisément le bug remonté : couverts identiques pour
-- des zones de tailles différentes). On les remet à null (= "auto") pour
-- que la capacité affichée reparte de la somme des places des tables
-- réellement placées dans chaque zone, recalculée à chaque changement de
-- table. L'équipe garde la main : ressaisir un nombre pour UN service
-- précis (écran Services > couv. max) le fige, les autres restent auto.
--
-- Aucun changement de structure — les colonnes sont déjà nullable.
-- =====================================================================

update service_templates set max_covers = null, max_covers_by_layout = '{}'::jsonb;
update service_overrides set max_covers = null, max_covers_by_layout = '{}'::jsonb;

notify pgrst, 'reload schema';
