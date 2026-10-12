-- Historique des modifications de team_config (types de service, capacités,
-- lien à emporter suspendu, PIN…) : quand, quoi, et depuis quel appareil.
--
-- Tous les postes se connectent avec le même compte équipe, donc auth_uid ne
-- distingue pas les personnes ; en revanche l'IP, le navigateur (user_agent) et
-- la session permettent de reconnaître l'appareil.
--
-- Le PIN n'est jamais copié dans l'historique : on note seulement qu'il a changé.
-- takeaway_order_counter est ignoré (il bouge à chaque commande, ça noierait le reste).
-- Idempotent : peut être rejoué sans risque.

create table if not exists team_config_audit (
  id bigint generated always as identity primary key,
  changed_at timestamptz not null default now(),
  restaurant_id text not null,
  changes jsonb not null,
  auth_uid uuid,
  session_id text,
  ip_address text,
  user_agent text
);

create index if not exists team_config_audit_restaurant_changed_at_idx
  on team_config_audit (restaurant_id, changed_at desc);

alter table team_config_audit enable row level security;

-- Lecture : son propre restaurant ou la Direction. Aucune policy d'écriture :
-- seul le trigger (security definer) insère, personne ne peut modifier l'historique.
drop policy if exists "team_config_audit_select" on team_config_audit;
create policy "team_config_audit_select" on team_config_audit
  for select to authenticated
  using (restaurant_id = my_restaurant_id() or is_manager());

create or replace function log_team_config_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  diff jsonb := '{}'::jsonb;
  k text;
  old_j jsonb := to_jsonb(old);
  new_j jsonb := to_jsonb(new);
  headers jsonb;
  claims jsonb;
begin
  for k in select jsonb_object_keys(new_j) loop
    if k = 'takeaway_order_counter' then
      continue;
    end if;
    if old_j -> k is distinct from new_j -> k then
      if k = 'pin' then
        diff := diff || jsonb_build_object(k, jsonb_build_object('old', '***', 'new', '***'));
      else
        diff := diff || jsonb_build_object(k, jsonb_build_object('old', old_j -> k, 'new', new_j -> k));
      end if;
    end if;
  end loop;

  if diff = '{}'::jsonb then
    return null;
  end if;

  begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    headers := null;
  end;
  begin
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then
    claims := null;
  end;

  insert into team_config_audit (restaurant_id, changes, auth_uid, session_id, ip_address, user_agent)
  values (
    new.restaurant_id,
    diff,
    auth.uid(),
    claims ->> 'session_id',
    headers ->> 'cf-connecting-ip',
    headers ->> 'user-agent'
  );
  return null;
end;
$$;

drop trigger if exists team_config_audit_trg on team_config;
create trigger team_config_audit_trg
  after update on team_config
  for each row execute function log_team_config_change();
