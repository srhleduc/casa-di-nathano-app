-- =====================================================================
-- Formules (ex. « La Formule Casa » 20 € = pizza + dessert + soda) —
-- créées et éditées depuis Direction → Formules.
--
-- Une formule = un prix + une liste d'« emplacements » (pizza, dessert,
-- boisson…), chacun avec les produits du menu qu'on peut y mettre et le
-- supplément éventuel de chaque produit (0 = inclus).
--   slots        : [{ "id": "main", "label": "Pizza",
--                     "items": [{ "itemId": "pizza-parma-xxxxx", "supplement": 2 }] }]
--   dine_in      : proposable sur place
--   takeaway     : proposable à emporter
--   restaurant_ids : restaurants concernés ; tableau vide = tous
--   service_slots  : services de la semaine où la formule est proposée,
--                    au format "<jour>-<groupe>" avec jour 0 = dimanche … 6 = samedi
--                    (= Date.getDay()) et groupe "midi" | "soir"
--                    (ex. "1-midi" = lundi midi). Vide = jamais proposée.
--
-- Catalogue partagé, lecture ouverte (les bornes en ont besoin), écriture
-- réservée aux managers. Additif, non cassant.
-- À exécuter une fois dans Supabase → SQL Editor.
-- =====================================================================

create table if not exists formulas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10, 2) not null default 0,
  dine_in boolean not null default true,
  takeaway boolean not null default true,
  restaurant_ids text[] not null default '{}',
  service_slots text[] not null default '{}',
  slots jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table formulas enable row level security;
drop policy if exists "formulas_select" on formulas;
drop policy if exists "formulas_write" on formulas;
create policy "formulas_select" on formulas for select to authenticated using (true);
create policy "formulas_write" on formulas for all to authenticated using (is_manager()) with check (is_manager());

alter publication supabase_realtime add table formulas;

-- Reprise de l'ancienne formule du midi (jusqu'ici codée en dur dans
-- lib/menu.js) : panuzzo + boisson + dessert à 14,50 €, boisson incluse
-- jusqu'à 3,70 € (+1,50 € au-delà), dessert inclus jusqu'à 6,30 € (supplément
-- = écart au-delà), tous les midis. Créée une seule fois.
insert into formulas (name, description, price, dine_in, takeaway, restaurant_ids, service_slots, slots, sort_order)
select
  'Formule du midi',
  'Panuzzo + boisson + dessert',
  14.5,
  true,
  true,
  '{}',
  array['0-midi', '1-midi', '2-midi', '3-midi', '4-midi', '5-midi', '6-midi'],
  jsonb_build_array(
    jsonb_build_object(
      'id', 'main', 'label', 'Panuzzo',
      'items', coalesce((select jsonb_agg(jsonb_build_object('itemId', m.id, 'supplement', 0) order by m.name) from menu_items m where m.cat = 'panuzzo'), '[]'::jsonb)
    ),
    jsonb_build_object(
      'id', 'drink', 'label', 'Boisson',
      'items', coalesce((
        select jsonb_agg(jsonb_build_object('itemId', m.id, 'supplement', case when m.price > 3.7 then 1.5 else 0 end) order by m.name)
        from menu_items m
        where m.cat in ('boisson', 'biere', 'vin', 'cocktail') and m.name not like '%1L%' and m.name not like '%(bouteille)%'
      ), '[]'::jsonb)
    ),
    jsonb_build_object(
      'id', 'dessert', 'label', 'Dessert',
      'items', coalesce((select jsonb_agg(jsonb_build_object('itemId', m.id, 'supplement', greatest(0, m.price - 6.3)) order by m.name) from menu_items m where m.cat = 'dessert'), '[]'::jsonb)
    )
  ),
  0
where not exists (select 1 from formulas where name = 'Formule du midi');

notify pgrst, 'reload schema';
