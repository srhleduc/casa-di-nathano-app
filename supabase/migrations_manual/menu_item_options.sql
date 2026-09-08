-- =====================================================================
-- Sous-catégories de produits (« options ») éditables depuis l'admin Menu.
--
-- Généralise les parfums glaces/sirops (table menu_flavors, supprimée en fin
-- de script) : n'importe quel produit peut porter une ou plusieurs
-- sous-catégories, chacune avec sa liste d'options, son nombre de choix et son
-- caractère obligatoire. Catalogue partagé (pas de restaurant_id), lecture
-- ouverte, écriture managers — comme menu_items.
--
--   menu_option_groups        : une sous-catégorie (« Parfum », « Cuisson »…)
--   menu_options              : les options d'un groupe
--   menu_item_option_groups   : rattache un groupe à un produit, avec le
--                               nombre de choix + obligatoire (portés par le
--                               rattachement pour qu'un même groupe puisse
--                               être partagé entre produits — ex. les 3
--                               tailles de glace partagent « Parfum glace »
--                               avec choices 1 / 2 / 3)
--
-- À coller dans Supabase → SQL Editor APRÈS déploiement du code (le code sait
-- fonctionner sans ces tables : repli sur les listes statiques de lib/menu.js).
-- =====================================================================

create table if not exists menu_option_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists menu_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references menu_option_groups (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (group_id, name)
);

create table if not exists menu_item_option_groups (
  id uuid primary key default gen_random_uuid(),
  menu_item_id text not null references menu_items (id) on delete cascade,
  group_id uuid not null references menu_option_groups (id) on delete cascade,
  choices integer not null default 1,
  required boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (menu_item_id, group_id)
);

alter table menu_option_groups enable row level security;
alter table menu_options enable row level security;
alter table menu_item_option_groups enable row level security;

drop policy if exists "menu_option_groups_select" on menu_option_groups;
drop policy if exists "menu_option_groups_write" on menu_option_groups;
create policy "menu_option_groups_select" on menu_option_groups for select to authenticated using (true);
create policy "menu_option_groups_write" on menu_option_groups for all to authenticated using (is_manager()) with check (is_manager());

drop policy if exists "menu_options_select" on menu_options;
drop policy if exists "menu_options_write" on menu_options;
create policy "menu_options_select" on menu_options for select to authenticated using (true);
create policy "menu_options_write" on menu_options for all to authenticated using (is_manager()) with check (is_manager());

drop policy if exists "menu_item_option_groups_select" on menu_item_option_groups;
drop policy if exists "menu_item_option_groups_write" on menu_item_option_groups;
create policy "menu_item_option_groups_select" on menu_item_option_groups for select to authenticated using (true);
create policy "menu_item_option_groups_write" on menu_item_option_groups for all to authenticated using (is_manager()) with check (is_manager());

alter publication supabase_realtime add table menu_option_groups;
alter publication supabase_realtime add table menu_options;
alter publication supabase_realtime add table menu_item_option_groups;

-- ---- Reprise des parfums existants ----------------------------------------
-- Deux groupes à identifiants fixes pour que les statements suivants s'y
-- réfèrent sans sous-requête.

insert into menu_option_groups (id, name, sort_order) values
  ('11111111-1111-1111-1111-111111111111', 'Parfum glace', 0),
  ('22222222-2222-2222-2222-222222222222', 'Parfum sirop', 1)
on conflict (id) do nothing;

insert into menu_options (group_id, name, sort_order)
  select '11111111-1111-1111-1111-111111111111', name, sort_order from menu_flavors where grp = 'glace'
on conflict (group_id, name) do nothing;

insert into menu_options (group_id, name, sort_order)
  select '22222222-2222-2222-2222-222222222222', name, sort_order from menu_flavors where grp = 'sirop'
on conflict (group_id, name) do nothing;

insert into menu_item_option_groups (menu_item_id, group_id, choices, required, sort_order)
  select id, '11111111-1111-1111-1111-111111111111', 1, true, 0 from menu_items where name = 'Glace 1 boule'
on conflict (menu_item_id, group_id) do nothing;

insert into menu_item_option_groups (menu_item_id, group_id, choices, required, sort_order)
  select id, '11111111-1111-1111-1111-111111111111', 2, true, 0 from menu_items where name = 'Glace 2 boules'
on conflict (menu_item_id, group_id) do nothing;

insert into menu_item_option_groups (menu_item_id, group_id, choices, required, sort_order)
  select id, '11111111-1111-1111-1111-111111111111', 3, true, 0 from menu_items where name = 'Glace 3 boules'
on conflict (menu_item_id, group_id) do nothing;

insert into menu_item_option_groups (menu_item_id, group_id, choices, required, sort_order)
  select id, '22222222-2222-2222-2222-222222222222', 1, true, 0 from menu_items where name = 'Sirop à l''eau'
on conflict (menu_item_id, group_id) do nothing;

insert into menu_item_option_groups (menu_item_id, group_id, choices, required, sort_order)
  select id, '22222222-2222-2222-2222-222222222222', 1, true, 0 from menu_items where name = 'Diabolo'
on conflict (menu_item_id, group_id) do nothing;

-- Ruptures par parfum : ancienne clé « flavor:<grp>:<parfum> » -> « opt:<groupId>:<parfum> ».
update ruptures set item_id = 'opt:11111111-1111-1111-1111-111111111111:' || substring(item_id from 14) where item_id like 'flavor:glace:%';
update ruptures set item_id = 'opt:22222222-2222-2222-2222-222222222222:' || substring(item_id from 14) where item_id like 'flavor:sirop:%';

drop table if exists menu_flavors;

notify pgrst, 'reload schema';
