-- Identifiant d'appareil + noms d'appareils pour le journal des saisies du code
-- équipe (voir team_pin_log.sql).
--
-- Chaque navigateur génère un identifiant aléatoire (localStorage) et l'envoie
-- avec chaque saisie ; la Direction peut ensuite le nommer (« Sarah », « Caisse
-- Riec »…) depuis l'onglet « Connexions équipe » pour repérer les appareils
-- inconnus. L'identifiant ne survit pas à un effacement des données du
-- navigateur : l'appareil réapparaît alors comme nouveau.
--
-- Les noms ne sont lisibles et modifiables que par la Direction (is_manager()).
-- Rejouable (if not exists / or replace), sauf la policy : la supprimer avant.

alter table team_pin_log add column if not exists device_id text;

create index if not exists team_pin_log_device_idx on team_pin_log (device_id);

create table if not exists team_device_names (
  device_id text primary key,
  name text not null,
  updated_at timestamptz not null default now()
);

alter table team_device_names enable row level security;

drop policy if exists "team_device_names_manager" on team_device_names;
create policy "team_device_names_manager" on team_device_names
  for all to authenticated
  using (is_manager())
  with check (is_manager());

revoke all on team_device_names from public, anon, authenticated;
grant select, insert, update, delete on team_device_names to authenticated;

-- Nouvelle signature avec p_device_id (valeur par défaut null) : l'ancienne
-- version du code, qui n'envoie pas d'identifiant, continue de fonctionner
-- pendant le déploiement.
drop function if exists log_team_pin_attempt(boolean, text, text, text, text, text);

create or replace function log_team_pin_attempt(
  p_success boolean,
  p_ip text,
  p_city text,
  p_region text,
  p_country text,
  p_user_agent text,
  p_device_id text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  rid text := my_restaurant_id();
begin
  if rid is null then
    return;
  end if;
  insert into team_pin_log (restaurant_id, success, ip_address, city, region, country, user_agent, device_id)
  values (rid, coalesce(p_success, false), left(p_ip, 64), left(p_city, 120), left(p_region, 120), left(p_country, 8), left(p_user_agent, 500), left(p_device_id, 64));
end;
$$;

revoke all on function log_team_pin_attempt(boolean, text, text, text, text, text, text) from public, anon;
grant execute on function log_team_pin_attempt(boolean, text, text, text, text, text, text) to authenticated;
