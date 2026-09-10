-- =====================================================================
-- Une seule commande sur place ouverte par (jeu de) table(s)
--
-- Deux clients qui scannent le même QR /sat au même instant (ou /sat T8 +
-- /sat T9 d'une combinaison) ne doivent créer qu'UNE commande : la 2e
-- insertion échoue (23505), l'app se rabat sur un ajout à la commande qui
-- vient d'être créée.
--
-- Index partiel : seulement les commandes sur place encore ouvertes et non
-- encaissées, avec au moins une table du registre. La clé est le tableau
-- table_ids complet (trié à l'écriture, côté app et par sat_append_items) :
-- {T1} vs {T1} => conflit ; {T8,T9} vs {T8,T9} => conflit ; {T8} vs {T9} =>
-- pas de conflit (deux tables distinctes non combinées).
--
-- À jouer HORS SERVICE. Vérifier d'abord qu'aucune table n'a déjà deux
-- commandes ouvertes (sinon la création de l'index échoue) :
--   select restaurant_id, table_ids, count(*)
--   from orders
--   where service_type = '🍽️ Sur place' and status <> 'servie'
--     and coalesce(paid, false) = false and coalesce(is_test, false) = false
--     and coalesce(array_length(table_ids, 1), 0) >= 1
--   group by 1, 2 having count(*) > 1;
-- =====================================================================

create unique index if not exists orders_one_open_dinein_tables
  on orders (restaurant_id, table_ids)
  where service_type = '🍽️ Sur place'
    and status <> 'servie'
    and coalesce(paid, false) = false
    and coalesce(is_test, false) = false
    and coalesce(array_length(table_ids, 1), 0) >= 1;

notify pgrst, 'reload schema';
