-- =====================================================================
-- Campagnes — plusieurs produits par campagne (ex. plusieurs parfums de
-- panettone). Remplace la colonne unique menu_item_id par une liste
-- menu_item_ids ; l'ancienne colonne est conservée (et reprise dans la
-- liste pour les campagnes déjà créées).
--
-- Additif. À exécuter une fois dans Supabase → SQL Editor.
-- =====================================================================

alter table campaigns add column if not exists menu_item_ids text[] not null default '{}';

update campaigns
set menu_item_ids = array[menu_item_id]
where menu_item_id is not null and menu_item_ids = '{}';

notify pgrst, 'reload schema';
