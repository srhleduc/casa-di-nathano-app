-- Journal d'activité par appareil : qui (quel appareil, quelle IP) a ajouté,
-- modifié ou supprimé quoi dans l'espace équipe / Direction.
--
-- Principe : le client Supabase envoie l'identifiant de l'appareil dans l'en-tête
-- `x-casa-device` (voir lib/supabaseClient.js). PostgREST l'expose à la base via
-- current_setting('request.headers'), avec l'IP (cf-connecting-ip) et le
-- user-agent : un trigger écrit une ligne dans team_activity_log pour chaque
-- ajout / modification / suppression sur les tables d'exploitation ci-dessous.
-- Aucune fonction de l'appli n'est modifiée une par une.
--
-- Règles :
--   * Un trigger ne journalise que les requêtes venant d'un appareil identifié
--     (en-tête présent) ou d'un compte Direction. Les crons, edge functions et
--     la commande en ligne (route serveur) ne passent pas par là.
--   * Le trigger ne doit JAMAIS faire échouer l'opération d'origine : toute erreur
--     est avalée (bloc exception).
--   * Valeurs tronquées à 120 caractères ; les champs sensibles (code équipe,
--     téléphone, texte CGV, photo, géoloc) ne sont jamais copiés.
--   * Lisible uniquement par la Direction (is_manager()). Purge à 90 jours.
--   * appro_stock_movements : seulement les ajouts (très volumineux).
--
-- Limite : l'identifiant d'appareil est celui du navigateur (localStorage). Il
-- n'existe qu'après une saisie du code équipe sur cet appareil, et change si les
-- données du navigateur sont effacées. Il ne prouve pas QUI tenait le téléphone.
--
-- Rejouable (if not exists / or replace / drop trigger if exists).

create table if not exists team_activity_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  restaurant_id text,
  device_id text,
  ip_address text,
  user_agent text,
  auth_uid uuid,
  is_manager boolean not null default false,
  table_name text not null,
  operation text not null,
  row_id text,
  changes jsonb not null default '{}'::jsonb
);

create index if not exists team_activity_log_created_idx on team_activity_log (created_at desc);
create index if not exists team_activity_log_device_idx on team_activity_log (device_id, created_at desc);

alter table team_activity_log enable row level security;

drop policy if exists "team_activity_log_manager_select" on team_activity_log;
create policy "team_activity_log_manager_select" on team_activity_log
  for select to authenticated
  using (is_manager());

revoke all on team_activity_log from public, anon, authenticated;
grant select on team_activity_log to authenticated;

create or replace function log_team_activity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  h jsonb;
  dev text;
  mgr boolean;
  o jsonb;
  n jsonb;
  k text;
  payload jsonb := '{}'::jsonb;
  skip text[] := array['pin','customer_phone','phone','cgv_text_snapshot','password','email','photo_url','geoloc','updated_at'];
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::jsonb;
    if h is null then
      return null;
    end if;
    dev := left(nullif(h ->> 'x-casa-device', ''), 64);
    mgr := coalesce(is_manager(), false);
    if dev is null and not mgr then
      return null;
    end if;

    if TG_OP = 'DELETE' then
      n := to_jsonb(OLD);
    else
      n := to_jsonb(NEW);
    end if;

    if TG_OP = 'UPDATE' then
      o := to_jsonb(OLD);
      for k in select jsonb_object_keys(n) loop
        if k = any(skip) then
          continue;
        end if;
        if o -> k is distinct from n -> k then
          payload := payload || jsonb_build_object(
            k, jsonb_build_object('old', left(o ->> k, 120), 'new', left(n ->> k, 120))
          );
        end if;
      end loop;
      if payload = '{}'::jsonb then
        return null;
      end if;
    else
      for k in select jsonb_object_keys(n) loop
        if k = any(skip) then
          continue;
        end if;
        payload := payload || jsonb_build_object(k, left(n ->> k, 120));
      end loop;
    end if;

    insert into team_activity_log (
      restaurant_id, device_id, ip_address, user_agent, auth_uid, is_manager,
      table_name, operation, row_id, changes
    )
    values (
      n ->> 'restaurant_id', dev, left(h ->> 'cf-connecting-ip', 64), left(h ->> 'user-agent', 500),
      auth.uid(), mgr, TG_TABLE_NAME, TG_OP, coalesce(n ->> 'id', n ->> 'restaurant_id'), payload
    );
  exception when others then
    null;
  end;
  return null;
end;
$$;

revoke all on function log_team_activity() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'orders', 'reservations', 'ruptures', 'pizza_stock', 'dessert_stock', 'menu_items',
    'takeaway_hours', 'online_booking_closures', 'pointage_corrections', 'staff',
    'service_overrides', 'service_exceptions', 'reservation_settings'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists team_activity_trg on %I', t);
      execute format(
        'create trigger team_activity_trg after insert or update or delete on %I for each row execute function log_team_activity()', t);
    end if;
  end loop;
end;
$$;

drop trigger if exists team_activity_trg on appro_stock_movements;
create trigger team_activity_trg
  after insert on appro_stock_movements
  for each row execute function log_team_activity();

-- Purge quotidienne (05:40) des lignes de plus de 90 jours.
select cron.schedule(
  'team-activity-log-purge',
  '40 5 * * *',
  $$ delete from team_activity_log where created_at < now() - interval '90 days'; $$
);

-- Pour désactiver : select cron.unschedule('team-activity-log-purge');
-- Pour arrêter le journal : drop trigger team_activity_trg on <table>;

notify pgrst, 'reload schema';
