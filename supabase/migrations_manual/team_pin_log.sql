-- Journal des saisies du code équipe (PinScreen) : quand, réussi ou non, depuis
-- quelle IP / ville estimée / appareil.
--
-- Contexte : le code équipe est vérifié dans le navigateur (PinScreen compare au
-- PIN lu dans team_config) et tous les postes partagent le même compte
-- Supabase ; rien n'était donc tracé. La saisie est maintenant signalée à la
-- Route Handler /api/team-access, qui ajoute l'IP et la ville (en-têtes Vercel)
-- puis appelle log_team_pin_attempt().
--
-- Visibilité : UNIQUEMENT la Direction (is_manager()). Le compte équipe ne peut
-- ni lire ni modifier ce journal — il ne peut qu'y ajouter une ligne via la
-- fonction ci-dessous. Le code saisi n'est jamais enregistré, seulement
-- « réussi / raté ».
--
-- Les instructions sont rejouables (create ... if not exists / or replace), sauf
-- la policy : la supprimer avant de rejouer.

create table if not exists team_pin_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  restaurant_id text not null,
  success boolean not null,
  ip_address text,
  city text,
  region text,
  country text,
  user_agent text
);

create index if not exists team_pin_log_restaurant_created_at_idx
  on team_pin_log (restaurant_id, created_at desc);

alter table team_pin_log enable row level security;

-- Lecture : Direction seulement. Aucune policy d'écriture : seul log_team_pin_attempt
-- (security definer) insère ; personne ne peut modifier ni effacer l'historique.
drop policy if exists "team_pin_log_select" on team_pin_log;
create policy "team_pin_log_select" on team_pin_log
  for select to authenticated
  using (is_manager());

-- Droits de table : on retire tout au public/anon/authenticated, puis on rend la
-- lecture à authenticated (filtrée par la policy ci-dessus).
revoke all on team_pin_log from public, anon, authenticated;
grant select on team_pin_log to authenticated;

-- Appelée par la Route Handler avec le jeton du compte équipe : le restaurant est
-- déduit de la session (my_restaurant_id), jamais fourni par le client.
create or replace function log_team_pin_attempt(
  p_success boolean,
  p_ip text,
  p_city text,
  p_region text,
  p_country text,
  p_user_agent text
)
returns void
language plpgsql
security definer set search_path = public
as $fn$
declare
  rid text := my_restaurant_id();
begin
  if rid is null then
    return;
  end if;
  insert into team_pin_log (restaurant_id, success, ip_address, city, region, country, user_agent)
  values (rid, coalesce(p_success, false), left(p_ip, 64), left(p_city, 120), left(p_region, 120), left(p_country, 8), left(p_user_agent, 500));
end;
$fn$;

revoke all on function log_team_pin_attempt(boolean, text, text, text, text, text) from public, anon;
grant execute on function log_team_pin_attempt(boolean, text, text, text, text, text) to authenticated;
