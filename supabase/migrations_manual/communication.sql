-- Espace « Casa communication » (déploiement Vercel dédié, NEXT_PUBLIC_APP_MODE=communication) :
-- planning de posts réseaux sociaux + bibliothèque de visuels.
-- Accès réservé aux comptes Direction (is_manager()). Voir components/communication/.

create table if not exists communication_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  path text not null unique,
  url text not null,
  media_type text not null default 'image',
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists communication_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  caption text not null default '',
  platforms text[] not null default '{}',
  -- null = les deux enseignes
  restaurant_id text references restaurants (id),
  scheduled_for date,
  status text not null default 'idea' check (status in ('idea', 'draft', 'scheduled', 'published')),
  asset_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table communication_assets enable row level security;
alter table communication_posts enable row level security;

create policy "communication_assets_managers" on communication_assets for all to authenticated
  using (is_manager()) with check (is_manager());
create policy "communication_posts_managers" on communication_posts for all to authenticated
  using (is_manager()) with check (is_manager());

-- Bucket des visuels : lecture publique (URLs réutilisables pour publier),
-- écriture réservée aux managers.
insert into storage.buckets (id, name, public)
values ('communication-visuels', 'communication-visuels', true)
on conflict (id) do nothing;

create policy "communication_visuels_public_read" on storage.objects for select to public
  using (bucket_id = 'communication-visuels');
create policy "communication_visuels_managers_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'communication-visuels' and is_manager());
create policy "communication_visuels_managers_update" on storage.objects for update to authenticated
  using (bucket_id = 'communication-visuels' and is_manager());
create policy "communication_visuels_managers_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'communication-visuels' and is_manager());
