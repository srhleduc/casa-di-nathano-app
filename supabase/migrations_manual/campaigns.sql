-- =====================================================================
-- Campagnes — écran affiché au client du click & collect (/commande) juste
-- AVANT de passer sa commande (ex. vente de panettone pour Noël), créé et
-- édité depuis Direction → Campagnes.
--
-- Une campagne = un titre + un texte (+ une photo) + deux boutons :
--   - « Je réserve le mien avec ma commande » : ajoute le produit lié au
--     panier (quantité choisie par le client) puis continue la commande ;
--   - « Passer à la commande » : continue sans rien ajouter.
-- Sans produit lié, la campagne est une simple annonce (un seul bouton).
--
--   title / description : texte affiché au client
--   image_url           : photo de la campagne (sinon, photo du produit lié)
--   menu_item_id        : produit du menu ajouté au panier (menu_items.id) ;
--                         null = annonce seule
--   reserve_label / skip_label : texte des deux boutons
--   restaurant_ids      : restaurants concernés ; tableau vide = tous
--   start_date / end_date : période d'affichage (inclus), null = sans limite
--   active              : interrupteur rapide
--
-- Catalogue partagé, lecture ouverte (le click & collect en a besoin),
-- écriture réservée aux managers. Additif, non cassant.
-- À exécuter une fois dans Supabase → SQL Editor.
-- =====================================================================

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text not null,
  description text,
  image_url text,
  menu_item_id text,
  reserve_label text not null default 'Je réserve le mien avec ma commande',
  skip_label text not null default 'Passer à la commande',
  restaurant_ids text[] not null default '{}',
  start_date date,
  end_date date,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table campaigns enable row level security;
drop policy if exists "campaigns_select" on campaigns;
drop policy if exists "campaigns_write" on campaigns;
create policy "campaigns_select" on campaigns for select to authenticated using (true);
create policy "campaigns_write" on campaigns for all to authenticated using (is_manager()) with check (is_manager());

alter publication supabase_realtime add table campaigns;

notify pgrst, 'reload schema';
