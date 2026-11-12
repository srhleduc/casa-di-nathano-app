-- =====================================================================
-- Catégories de menu gérables depuis Direction → Catégories : créer une
-- nouvelle catégorie (ex. « 🎄 Noël ») et activer / désactiver n'importe
-- quelle catégorie (une catégorie désactivée disparaît des écrans de
-- commande — borne, /commande, /sat, prise de commande équipe — mais ses
-- produits sont conservés et réapparaissent à la réactivation).
--
--   key        : identifiant stocké dans menu_items.cat (jamais modifié)
--   label/emoji: nom affiché
--   active     : interrupteur rapide
--   sort_order : ordre dans les listes d'administration (l'ordre des onglets
--                de commande reste réglé par Direction → Ordre des catégories)
--
-- Catalogue partagé entre les restaurants, lecture ouverte (les bornes en
-- ont besoin), écriture réservée aux managers. Additif, non cassant : tant
-- que la table est vide ou absente, l'app utilise les 10 catégories d'origine.
-- À exécuter une fois dans Supabase → SQL Editor.
-- =====================================================================

create table if not exists menu_categories (
  key text primary key,
  label text not null,
  emoji text not null default '🏷️',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table menu_categories enable row level security;
drop policy if exists "menu_categories_select" on menu_categories;
drop policy if exists "menu_categories_write" on menu_categories;
create policy "menu_categories_select" on menu_categories for select to authenticated using (true);
create policy "menu_categories_write" on menu_categories for all to authenticated using (is_manager()) with check (is_manager());

alter publication supabase_realtime add table menu_categories;

-- Amorçage : les 10 catégories d'origine (lib/menu.js CATEGORIES), toutes
-- actives. `on conflict do nothing` = ne réécrase rien si rejoué.
insert into menu_categories (key, label, emoji, sort_order) values
  ('pizza',     'Pizzas',    '🍕', 0),
  ('panuzzo',   'Panuzzo',   '🥙', 1),
  ('antipasti', 'Antipasti', '🥖', 2),
  ('salade',    'Salades',   '🥗', 3),
  ('boisson',   'Boissons',  '🥤', 4),
  ('biere',     'Bières',    '🍺', 5),
  ('vin',       'Vins',      '🍷', 6),
  ('cocktail',  'Cocktails', '🍸', 7),
  ('cafe',      'Café/Thés', '☕', 8),
  ('dessert',   'Desserts',  '🍰', 9)
on conflict (key) do nothing;

notify pgrst, 'reload schema';
