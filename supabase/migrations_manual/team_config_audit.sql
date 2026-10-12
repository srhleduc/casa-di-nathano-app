-- Historique des modifications de team_config (types de service, capacités,
-- lien à emporter suspendu, PIN…) : quand, quoi, et depuis quel appareil.
--
-- Tous les postes se connectent avec le même compte équipe, donc auth_uid ne
-- distingue pas les personnes ; en revanche l'IP, le navigateur (user_agent) et
-- la session permettent de reconnaître l'appareil.
--
-- Le PIN n'est jamais copié dans l'historique : on note seulement qu'il a changé.
-- takeaway_order_counter est ignoré (il bouge à chaque commande).
-- Appliqué en production le 2026-10-12. Les instructions ci-dessous sont
-- rejouables (create ... if not exists / or replace) sauf la policy : la
-- supprimer avant de rejouer.

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
-- seul le trigger (security definer) insère, l'historique n'est pas modifiable.
drop policy if exists "team_config_audit_select" on team_config_audit;
create policy "team_config_audit_select" on team_config_audit
  for select to authenticated
  using (restaurant_id = my_restaurant_id() or is_manager());

create or replace function log_team_config_change()
returns trigger
language plpgsql
security definer set search_path = public
as $fn$
declare
  diff jsonb := '{}'::jsonb;
  k text;
  o jsonb := to_jsonb(old) - 'takeaway_order_counter';
  n jsonb := to_jsonb(new) - 'takeaway_order_counter';
  h jsonb := nullif(current_setting('request.headers', true), '')::jsonb;
  c jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
begin
  for k in select jsonb_object_keys(n) loop
    if o -> k is distinct from n -> k then
      diff := diff || jsonb_build_object(k, case when k = 'pin' then jsonb_build_object('old', '***', 'new', '***') else jsonb_build_object('old', o -> k, 'new', n -> k) end);
    end if;
  end loop;
  if diff <> '{}'::jsonb then
    insert into team_config_audit (restaurant_id, changes, auth_uid, session_id, ip_address, user_agent)
    values (new.restaurant_id, diff, auth.uid(), c ->> 'session_id', h ->> 'cf-connecting-ip', h ->> 'user-agent');
  end if;
  return null;
end;
$fn$;

drop trigger if exists team_config_audit_trg on team_config;
create trigger team_config_audit_trg
  after update on team_config
  for each row execute function log_team_config_change();
