-- =====================================================================
-- SAT — signal « ajout client » sur l'écran Service.
-- Quand un client ajoute quelque chose via /sat (nouvel article sur une
-- commande ouverte, ou nouvelle commande), on horodate orders.sat_addition_at.
-- L'écran Service met alors la pastille de la table tout devant, avec un
-- point rose. Le clic sur la pastille efface l'horodatage.
--
-- Additif. À exécuter une fois dans Supabase → SQL Editor.
-- =====================================================================

alter table orders add column if not exists sat_addition_at timestamptz;

notify pgrst, 'reload schema';
