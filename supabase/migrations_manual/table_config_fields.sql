-- Panneau de configuration des tables (façon TheFork) — module Réservation.
-- Capacités min / préférée / max, visibilité « réservation en ligne », blocage,
-- ordre de priorité de remplissage (valable pour tout l'établissement).
-- Additif, non cassant : aucune ligne existante n'est perdue.
--
-- À coller dans Supabase → SQL Editor. Une instruction par ligne (pas de
-- fonction, pas de `;` interne) pour éviter le découpage/troncature de l'éditeur.

alter table tables add column if not exists capacity_min int not null default 1;
alter table tables add column if not exists capacity_preferred int not null default 2;
alter table tables add column if not exists capacity_max int not null default 2;
alter table tables add column if not exists bookable_online boolean not null default true;
alter table tables add column if not exists blocked boolean not null default false;
alter table tables add column if not exists priority_order int;

-- Reprise de l'ancienne capacité unique (capacity_base) comme capacité préférée
-- ET max, pour ne pas rétrécir les capacités déjà saisies par l'équipe.
update tables set capacity_preferred = greatest(1, coalesce(capacity_base, 2)), capacity_max = greatest(1, coalesce(capacity_base, 2)) where capacity_base is not null;

notify pgrst, 'reload schema';
