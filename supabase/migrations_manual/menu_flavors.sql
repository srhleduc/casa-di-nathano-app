-- =====================================================================
-- Parfums des glaces / sirops — éditables depuis l'admin Menu (Direction),
-- au lieu des listes codées en dur dans lib/menu.js (GLACE_FLAVORS /
-- SIROP_FLAVORS, conservées comme repli si la table est absente/vide).
-- Catalogue partagé entre les deux restaurants (pas de restaurant_id),
-- lecture ouverte (les bornes en ont besoin), écriture réservée aux managers.
--
-- « grp » et non « group » (mot réservé SQL).
-- Additif. À exécuter une fois dans Supabase → SQL Editor.
-- =====================================================================

create table if not exists menu_flavors (
  id uuid primary key default gen_random_uuid(),
  grp text not null check (grp in ('glace', 'sirop')),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (grp, name)
);

alter table menu_flavors enable row level security;
drop policy if exists "menu_flavors_select" on menu_flavors;
drop policy if exists "menu_flavors_write" on menu_flavors;
create policy "menu_flavors_select" on menu_flavors for select to authenticated using (true);
create policy "menu_flavors_write" on menu_flavors for all to authenticated using (is_manager()) with check (is_manager());

alter publication supabase_realtime add table menu_flavors;

-- Amorçage avec les listes actuelles.
insert into menu_flavors (grp, name, sort_order) values
  ('glace', 'Vanille', 0), ('glace', 'Fior di latte', 1), ('glace', 'Chocolat', 2),
  ('glace', 'Stracciatella', 3), ('glace', 'Cerise amarena', 4), ('glace', 'Citron', 5),
  ('glace', 'Noisette', 6), ('glace', 'Pistache', 7), ('glace', 'Fraise', 8),
  ('sirop', 'Fraise', 0), ('sirop', 'Framboise', 1), ('sirop', 'Pêche', 2), ('sirop', 'Menthe', 3),
  ('sirop', 'Grenadine', 4), ('sirop', 'Vanille', 5), ('sirop', 'Citron', 6), ('sirop', 'Mojito', 7),
  ('sirop', 'Litchi', 8), ('sirop', 'Yuzu', 9), ('sirop', 'Caramel', 10),
  ('sirop', 'Fruit de la passion', 11), ('sirop', 'Basilic', 12), ('sirop', 'Orgeat', 13)
on conflict (grp, name) do nothing;

notify pgrst, 'reload schema';
