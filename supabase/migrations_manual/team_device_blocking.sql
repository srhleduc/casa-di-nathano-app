-- Blocage d'appareils de l'espace équipe (voir team_pin_log.sql et
-- team_device_names.sql).
--
-- La Direction peut BLOQUER un appareil (départ d'un salarié, téléphone perdu) :
-- il est refusé quand il tape le code équipe, même si le code est bon, sans
-- changer le code. Un appareil jamais vu reste accepté (extra, nouveau salarié).
--
-- Limites assumées : le contrôle se fait au moment de la saisie du code, dans le
-- navigateur (comme la vérification du code elle-même) ; ce n'est pas une barrière
-- contre quelqu'un de technique. Effacer les données du navigateur ou utiliser la
-- navigation privée crée un nouvel appareil inconnu, donc accepté. En cas de panne
-- du contrôle, l'appli laisse passer (jamais de blocage du service).
--
-- Rejouable (if not exists / or replace).

alter table team_device_names add column if not exists blocked boolean not null default false;

alter table team_pin_log add column if not exists refused boolean not null default false;

-- Appelée par l'écran du code avec la session du compte équipe. Ne révèle qu'un
-- oui / non : faux seulement si cet appareil est explicitement bloqué.
create or replace function is_team_device_allowed(p_device_id text)
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if p_device_id is null then
    return true;
  end if;
  return not exists (select 1 from team_device_names where device_id = p_device_id and blocked);
end;
$$;

revoke all on function is_team_device_allowed(text) from public, anon;
grant execute on function is_team_device_allowed(text) to authenticated;

-- Même signature qu'avant : on ajoute seulement la colonne « refused »
-- (code correct mais appareil bloqué), calculée côté serveur.
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
