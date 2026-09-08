-- =====================================================================
-- Menu — deux nouveaux drapeaux de disponibilité par produit (admin Menu,
-- espace Direction), en plus de dine_in_only :
--   takeaway_only : visible uniquement quand le canal est "à emporter"
--                   (miroir de dine_in_only)
--   staff_only    : visible uniquement dans les flux équipe (prise de
--                   commande, édition, programmée) — jamais côté client
--                   (borne, /commande, /sat)
--
-- Additif. À exécuter une fois dans Supabase → SQL Editor.
-- =====================================================================

alter table menu_items add column if not exists takeaway_only boolean not null default false;
alter table menu_items add column if not exists staff_only boolean not null default false;

notify pgrst, 'reload schema';
