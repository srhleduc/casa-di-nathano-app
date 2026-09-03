create table if not exists loyalty_public_lookups (id bigint generated always as identity primary key, ip text not null, at timestamptz not null default now());

create index if not exists loyalty_public_lookups_ip_at_idx on loyalty_public_lookups (ip, at desc);

alter table loyalty_public_lookups enable row level security;

create or replace function resolve_loyalty_customer_public(p_phone text, p_nom text, p_ip text) returns table (id uuid, nom text, solde_points integer, status text) language plpgsql security definer set search_path = public, extensions as $body$ declare v_ip text := coalesce(nullif(btrim(p_ip), ''), 'unknown'); v_phone text; v_nom text := unaccent(lower(btrim(coalesce(p_nom, '')))); v_recent integer; begin select count(*) into v_recent from loyalty_public_lookups where ip = v_ip and at > now() - interval '10 minutes'; insert into loyalty_public_lookups (ip) values (v_ip); delete from loyalty_public_lookups where at < now() - interval '1 day'; if v_recent >= 12 then return query select null::uuid, null::text, null::integer, 'rate_limited'::text; return; end if; v_phone := regexp_replace(coalesce(p_phone, ''), '[\s.\-()]', '', 'g'); if v_phone like '+33%' then v_phone := '0' || substr(v_phone, 4); elsif v_phone like '0033%' then v_phone := '0' || substr(v_phone, 5); elsif v_phone like '+590%' then v_phone := '0' || substr(v_phone, 5); elsif v_phone like '+594%' then v_phone := '0' || substr(v_phone, 5); end if; if v_phone !~ '^0[1-9][0-9]{8}$' or length(v_nom) < 2 then return query select null::uuid, null::text, null::integer, 'not_found'::text; return; end if; return query select lc.id, lc.nom, lc.solde_points, 'ok'::text from loyalty_customers lc where lc.phone = v_phone and position(' ' || v_nom || ' ' in ' ' || unaccent(lower(coalesce(lc.nom, ''))) || ' ') > 0 limit 1; if not found then return query select null::uuid, null::text, null::integer, 'not_found'::text; end if; end; $body$;

grant execute on function resolve_loyalty_customer_public(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
