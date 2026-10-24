-- Mode « appareils autorisés » de l'espace équipe (voir team_pin_log.sql et
-- team_device_names.sql).
--
-- Quand la Direction l'active pour un restaurant, seul un appareil NOMMÉ (présent
-- dans team_device_names) peut ouvrir l'espace équipe, même avec le bon code. Pour
-- retirer un appareil (démission, téléphone perdu) : lui retirer son nom, sans
-- changer le code. Désactivé par défaut.
--
-- Limites assumées : le contrôle se fait au moment de la saisie du code, dans
-- le navigateur (comme la vérification du code elle-même) ; ce n'est pas une
-- barrière contre quelqu'un de technique. Un appareil sans identifiant
-- (stockage bloqué, navigation privée) est refusé quand le mode est actif. En
-- cas de panne du contrôle, l'appli laisse passer (jamais de blocage du service).
--
-- Rejouable (if not exists / or replace), sauf la policy : la supprimer avant.

create table if not exists team_device_settings (
  restaurant_id text primary key,
  allowlist_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table team_device_settings enable row level security;

drop policy if exists "team_device_settings_manager" on team_device_settings;
create policy "team_device_settings_manager" on team_device_settings
  for all to authenticated
  using (is_manager())
  with check (is_manager());

revoke all on team_device_settings from public, anon, authenticated;
grant select, insert, update, delete on team_device_settings to authenticated;

alter table team_pin_log add column if not exists refused boolean not null default false;

-- Appelée par l'écran du code avec la session du compte équipe : le restaurant
-- vient de la session, jamais du client. Ne révèle qu'un oui / non.
create or replace function is_team_device_allowed(p_device_id text)
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
declare
  rid text := my_restaurant_id();
  enabled boolean;
begin
  if rid is null then
    return true;
  end if;
  select allowlist_enabled into enabled from team_device_settings where restaurant_id = rid;
  if coalesce(enabled, false) = false then
    return true;
  end if;
  return p_device_id is not null
    and exists (select 1 from team_device_names where device_id = p_device_id);
end;
$$;

revoke all on function is_team_device_allowed(text) from public, anon;
grant execute on function is_team_device_allowed(text) to authenticated;

-- Même signature qu'avant : on ajoute seulement la colonne « refused »
-- (code correct mais appareil non autorisé), calculée côté serveur.
create or replace function log_team_pin_attempt(p_success boolean, p_ip text, p_city text, p_region text, p_country text, p_user_agent text, p_device_id text default null)
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
  insert into team_pin_log (restaurant_id, success, ip_address, city, region, country, user_agent, device_id, refused)
  values (rid, coalesce(p_success, false), left(p_ip, 64), left(p_city, 120), left(p_region, 120), left(p_country, 8), left(p_user_agent, 500), left(p_device_id, 64),
          coalesce(p_success, false) and not is_team_device_allowed(p_device_id));
end;
$$;
