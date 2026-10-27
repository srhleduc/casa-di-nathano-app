-- Numéros fixes pour les appareils inconnus de l'espace équipe (voir
-- team_pin_log.sql, team_device_names.sql et team_device_blocking.sql).
--
-- Un appareil jamais nommé reçoit un numéro à sa PREMIÈRE saisie du code, une fois
-- pour toutes : « Appareil inconnu 1 », « Appareil inconnu 2 »… Le numéro ne
-- change plus, même si d'autres appareils sont nommés ensuite, et il est affiché
-- à chaque reconnexion du même appareil (même identifiant navigateur). Un appareil
-- déjà nommé à sa saisie ne consomme pas de numéro.
--
-- Limite : l'identifiant est celui du navigateur. Si les données du navigateur sont
-- effacées, le même téléphone repart avec un nouvel identifiant, donc un nouveau numéro.
--
-- Lisible uniquement par la Direction (is_manager()) ; écrit par la fonction
-- log_team_pin_attempt (security definer). Rejouable.

create table if not exists team_device_numbers (
  device_id text primary key,
  number integer generated always as identity,
  created_at timestamptz not null default now()
);

alter table team_device_numbers enable row level security;

drop policy if exists "team_device_numbers_manager" on team_device_numbers;
create policy "team_device_numbers_manager" on team_device_numbers
  for select to authenticated
  using (is_manager());

revoke all on team_device_numbers from public, anon, authenticated;
grant select on team_device_numbers to authenticated;

-- Numérote les appareils déjà connus mais jamais nommés, du plus ancien au plus récent.
insert into team_device_numbers (device_id, created_at)
select l.device_id, min(l.created_at)
from team_pin_log l
where l.device_id is not null
  and not exists (select 1 from team_device_names n where n.device_id = l.device_id)
  and not exists (select 1 from team_device_numbers x where x.device_id = l.device_id)
group by l.device_id
order by min(l.created_at);

-- Même signature qu'avant : on ajoute seulement l'attribution du numéro.
create or replace function log_team_pin_attempt(p_success boolean, p_ip text, p_city text, p_region text, p_country text, p_user_agent text, p_device_id text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  rid text := my_restaurant_id();
  did text := left(p_device_id, 64);
begin
  if rid is null then
    return;
  end if;
  insert into team_pin_log (restaurant_id, success, ip_address, city, region, country, user_agent, device_id, refused)
  values (rid, coalesce(p_success, false), left(p_ip, 64), left(p_city, 120), left(p_region, 120), left(p_country, 8), left(p_user_agent, 500), did,
          coalesce(p_success, false) and not is_team_device_allowed(p_device_id));

  -- Appareil jamais nommé et pas encore numéroté : il reçoit le numéro suivant.
  if did is not null
     and not exists (select 1 from team_device_names where device_id = did)
     and not exists (select 1 from team_device_numbers where device_id = did) then
    insert into team_device_numbers (device_id) values (did) on conflict (device_id) do nothing;
  end if;
end;
$$;
