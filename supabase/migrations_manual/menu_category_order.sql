-- =====================================================================
-- Ordre d'affichage des catégories de menu — configurable par la Direction,
-- distinct pour la vue CLIENT (borne, /commande, /sat) et la vue ÉQUIPE
-- (prise de commande, édition, commande programmée).
--
-- Catalogue partagé entre les deux restaurants (comme menu_items) : pas de
-- restaurant_id. Lecture ouverte à tout compte authentifié (les bornes en
-- ont besoin), écriture réservée aux managers.
--
-- Additif. À exécuter une fois dans Supabase → SQL Editor.
-- =====================================================================

create table if not exists category_order (
  scope text primary key check (scope in ('client', 'staff')),
  keys jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table category_order enable row level security;

drop policy if exists "category_order_select" on category_order;
drop policy if exists "category_order_write" on category_order;
create policy "category_order_select" on category_order for select to authenticated using (true);
create policy "category_order_write" on category_order for all to authenticated using (is_manager()) with check (is_manager());

alter publication supabase_realtime add table category_order;

-- Amorçage : ordre actuel (celui codé dans lib/menu.js CATEGORIES), identique
-- pour les deux vues au départ. `on conflict do nothing` = ne réécrase pas une
-- config déjà posée si la migration est rejouée.
insert into category_order (scope, keys) values
  ('client', '["pizza","panuzzo","antipasti","salade","boisson","biere","vin","cocktail","cafe","dessert"]'::jsonb),
  ('staff',  '["pizza","panuzzo","antipasti","salade","boisson","biere","vin","cocktail","cafe","dessert"]'::jsonb)
on conflict (scope) do nothing;

notify pgrst, 'reload schema';
