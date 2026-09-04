-- =====================================================================
-- SAT — nom d'affichage libre par table.
-- `tables.number` reste le CODE stable encodé dans le QR (/sat?table=N,
-- ne change jamais). `tables.label` est le nom affiché partout (écrans
-- équipe, chips de prise de commande, /sat), librement modifiable par
-- l'équipe (ex. « T1 », « E3 » pour une table extérieure).
--
-- Additif. À exécuter une fois dans Supabase → SQL Editor.
-- =====================================================================

alter table tables add column if not exists label text;

-- Tables déjà créées : nom d'affichage par défaut = « Table <code> », pour
-- que rien ne change visuellement tant que l'équipe n'a pas renommé.
update tables set label = 'Table ' || number where label is null;

notify pgrst, 'reload schema';
