-- Publication automatique sur Facebook / Instagram depuis « Casa communication ».
-- - social_accounts : pages Facebook + comptes Instagram connectés (un par enseigne).
--   Les JETONS d'accès ne sont lisibles que par les Edge Functions (clé service) :
--   le navigateur n'a le droit de lire que les colonnes non sensibles.
-- - communication_posts : heure précise de publication + comptes ciblés + statuts publishing / failed.
-- - communication_post_results : résultat de la publication, compte par compte.
-- Edge Functions : meta-connect (connexion OAuth Meta) et publish-social-posts (cron toutes les 5 min).

create table if not exists social_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('facebook', 'instagram')),
  external_id text not null,
  name text not null,
  restaurant_id text references restaurants (id),
  access_token text not null,
  status text not null default 'ok' check (status in ('ok', 'error')),
  connected_at timestamptz not null default now(),
  unique (platform, external_id)
);
alter table social_accounts enable row level security;

revoke all on social_accounts from anon, authenticated;
grant select (id, platform, external_id, name, restaurant_id, status, connected_at) on social_accounts to authenticated;
grant update (restaurant_id) on social_accounts to authenticated;
grant delete on social_accounts to authenticated;

create policy "social_accounts_managers_select" on social_accounts for select to authenticated using (is_manager());
create policy "social_accounts_managers_update" on social_accounts for update to authenticated
  using (is_manager()) with check (is_manager());
create policy "social_accounts_managers_delete" on social_accounts for delete to authenticated using (is_manager());

alter table communication_posts add column if not exists scheduled_at timestamptz;
alter table communication_posts add column if not exists account_ids uuid[] not null default '{}';
alter table communication_posts add column if not exists publishing_started_at timestamptz;
alter table communication_posts add column if not exists published_at timestamptz;

-- Les anciens posts n'avaient qu'une date : on les place à 12h (heure de Paris).
update communication_posts
set scheduled_at = (scheduled_for::timestamp + time '12:00') at time zone 'Europe/Paris'
where scheduled_at is null and scheduled_for is not null;

alter table communication_posts drop constraint if exists communication_posts_status_check;
alter table communication_posts add constraint communication_posts_status_check
  check (status in ('idea', 'draft', 'scheduled', 'publishing', 'published', 'failed'));

create index if not exists communication_posts_due_idx on communication_posts (scheduled_at) where status = 'scheduled';

create table if not exists communication_post_results (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references communication_posts (id) on delete cascade,
  account_id uuid not null references social_accounts (id) on delete cascade,
  status text not null check (status in ('pending', 'published', 'failed')),
  external_id text,
  container_id text,
  error text,
  attempts int not null default 0,
  updated_at timestamptz not null default now(),
  unique (post_id, account_id)
);
alter table communication_post_results enable row level security;
create policy "communication_post_results_managers_select" on communication_post_results for select to authenticated
  using (is_manager());
-- Écriture : seules les Edge Functions (clé service) enregistrent les résultats. La Direction peut
-- seulement supprimer un résultat (replanifier un post en échec le remet à zéro).
create policy "communication_post_results_managers_delete" on communication_post_results for delete to authenticated
  using (is_manager());

-- Publication des posts arrivés à échéance, toutes les 5 minutes.
-- (Fonction déployée avec --no-verify-jwt, comme generate-daily-slots.)
select cron.schedule(
  'publish-social-posts',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := 'https://tvuqyrkomuwlapevgekv.functions.supabase.co/publish-social-posts'
    );
  $$
);
-- Pour désactiver : select cron.unschedule('publish-social-posts');
