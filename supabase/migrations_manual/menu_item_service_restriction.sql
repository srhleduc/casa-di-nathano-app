-- =====================================================================
-- Menu — restriction à un service (admin Menu, Direction). "midi" | "soir"
-- | null (tous les services). Masqué partout où l'on commande tant que ce
-- groupe de service n'est pas ouvert d'après les services de réservation
-- résolus du jour (lib/reservation/services.js activeServiceGroups),
-- coupure identique à la formule du midi (PANUZZO_CUTOFF_HOUR).
-- =====================================================================

alter table menu_items add column if not exists service_restriction text;

notify pgrst, 'reload schema';
