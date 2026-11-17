-- Approbation des NOUVEAUX appareils de l'espace équipe (voir team_pin_log.sql,
-- team_device_names.sql et team_device_blocking.sql).
--
-- Avant : un appareil jamais vu était accepté dès que le code équipe était bon.
-- Maintenant : un appareil jamais vu reste « en attente » tant que la Direction
-- ne l'a pas approuvé (bandeau rose en haut de l'espace Direction). Les appareils
-- déjà reconnus continuent d'entrer normalement :
--   - nommés par la Direction (team_device_names, non bloqués) ;
--   - ou déjà connectés avant cette migration (repris ci-dessous comme approuvés).
-- Un appareil bloqué reste bloqué ; un appareil refusé est bloqué.
--
-- Limites assumées (comme le blocage) : le contrôle se fait dans le navigateur au
-- moment de la saisie du code ; ce n'est pas une barrière contre quelqu'un de
-- technique. Effacer les données du navigateur ou la navigation privée crée un
-- nouvel appareil, qui doit donc être approuvé à nouveau. En cas de panne du
-- contrôle (réseau, base), l'appli laisse passer : jamais de blocage du service.
--
-- Rejouable (if not exists / or replace), sauf la policy : la supprimer avant.

create table if not exists team_device_requests (
  device_id text primary key,
  status text not null default 'pending' check (status in ('pending', 'approved', 'refused')),
  restaurant_id text,
  user_agent text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists team_device_requests_status_idx on team_device_requests (status, requested_at desc);

alter table team_device_requests enable row level security;

-- Direction seulement (lecture et décision). Le compte équipe n'accède jamais à la
-- table : il passe par les deux fonctions ci-dessous.
drop policy if exists "team_device_requests_manager" on team_device_requests;
create policy "team_device_requests_manager" on team_device_requests
  for all to authenticated
  using (is_manager())
  with check (is_manager());

revoke all on team_device_requests from public, anon, authenticated;
grant select, insert, update, delete on team_device_requests to authenticated;

-- Reprise de l'existant : tout appareil déjà connu du journal, et pas bloqué, est
-- considéré comme approuvé (pas de souci pour ceux qui se connectent déjà).
insert into team_device_requests (device_id, status, restaurant_id, requested_at, decided_at)
select l.device_id, 'approved', (array_agg(l.restaurant_id order by l.created_at))[1], min(l.created_at), now()
from team_pin_log l
where l.device_id is not null
  and not exists (select 1 from team_device_names n where n.device_id = l.device_id and n.blocked)
group by l.device_id
on conflict (device_id) do nothing;

-- État d'un appareil, appelé par l'écran du code avec la session du compte équipe :
--   'approved' | 'pending' | 'blocked' | 'unknown' (jamais vu).
-- Sans identifiant (ancien client) : 'approved', comme avant.
create or replace function team_device_status(p_device_id text)
returns text
language plpgsql
stable
security definer set search_path = public
as $$
declare
  did text := left(p_device_id, 64);
  st text;
begin
  if did is null then
    return 'approved';
  end if;
  if exists (select 1 from team_device_names where device_id = did and blocked) then
    return 'blocked';
  end if;
  if exists (select 1 from team_device_names where device_id = did) then
    return 'approved';
  end if;
  select status into st from team_device_requests where device_id = did;
  if st is null then
    return 'unknown';
  end if;
  if st = 'approved' then
    return 'approved';
  end if;
  if st = 'refused' then
    return 'blocked';
  end if;
  return 'pending';
end;
$$;

revoke all on function team_device_status(text) from public, anon;
grant execute on function team_device_status(text) to authenticated;

-- Crée la demande d'approbation d'un appareil jamais vu (le restaurant est déduit de
-- la session, jamais fourni par le client). Idempotent : un appareil déjà connu
-- garde son état. Renvoie l'état après l'appel.
create or replace function request_team_device_approval(p_device_id text, p_user_agent text default null)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  did text := left(p_device_id, 64);
  rid text := my_restaurant_id();
begin
  if did is null or rid is null then
    return 'approved';
  end if;
  if team_device_status(did) = 'unknown' then
    insert into team_device_requests (device_id, status, restaurant_id, user_agent)
    values (did, 'pending', rid, left(p_user_agent, 500))
    on conflict (device_id) do nothing;
  end if;
  return team_device_status(did);
end;
$$;

revoke all on function request_team_device_approval(text, text) from public, anon;
grant execute on function request_team_device_approval(text, text) to authenticated;
