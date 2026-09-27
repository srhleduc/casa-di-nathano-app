-- =====================================================================
-- Rallonge la rétention de order_commitments (preuve anti no-show : nom,
-- téléphone, IP, user-agent, CGV acceptées) au-delà de la commande elle-
-- même.
--
-- Problème : le job quotidien 'casa-di-nathano-daily-reset' (04:00) fait
-- `delete from orders where date(created_at) < current_date`. Comme
-- order_commitments.order_id référence orders(id) ON DELETE CASCADE, la
-- preuve de no-show disparaissait avec la commande le lendemain matin —
-- constaté sur le cas Julie et sur un no-show du 13/09 devenus
-- irrécupérables.
--
-- Fix : order_id passe en ON DELETE SET NULL (même pattern que
-- loyalty_movements.order_id plus bas dans ce schéma) — la ligne
-- order_commitments survit à la purge de la commande, seul le lien vers
-- orders devient nul. Une purge dédiée, mensuelle, supprime ensuite les
-- lignes de plus de 24 mois : assez long pour documenter un client
-- récidiviste sur plusieurs mois, mais pas une conservation indéfinie
-- (proportionnalité RGPD — même base légale, intérêt légitime anti-fraude,
-- que la collecte elle-même).
-- =====================================================================

alter table order_commitments alter column order_id drop not null;

alter table order_commitments
  drop constraint if exists order_commitments_order_id_fkey;

alter table order_commitments
  add constraint order_commitments_order_id_fkey
  foreign key (order_id) references orders (id) on delete set null;

-- Purge mensuelle des preuves de commande de plus de 24 mois (le 2 de
-- chaque mois à 05:35, juste après la purge fidélité déjà en place).
select cron.schedule(
  'order-commitments-purge',
  '35 5 2 * *',
  $$
    delete from order_commitments
    where created_at < now() - interval '24 months';
  $$
);

-- Pour désactiver plus tard : select cron.unschedule('order-commitments-purge');

notify pgrst, 'reload schema';
