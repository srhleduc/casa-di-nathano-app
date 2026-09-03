alter table loyalty_customers add column if not exists wallet_added_at timestamptz;

create or replace function get_loyalty_wallet_customer(p_id uuid) returns table (nom text, solde_points integer, wallet_added_at timestamptz) language sql security definer set search_path = public as 'select nom, solde_points, wallet_added_at from loyalty_customers where id = p_id';

grant execute on function get_loyalty_wallet_customer(uuid) to anon, authenticated;

create or replace function resolve_loyalty_wallet_by_phone(p_phone text) returns table (id uuid, solde_points integer) language plpgsql security definer set search_path = public as $body$ declare v_phone text; begin v_phone := regexp_replace(coalesce(p_phone, ''), '[\s.\-()]', '', 'g'); if v_phone like '+33%' then v_phone := '0' || substr(v_phone, 4); elsif v_phone like '0033%' then v_phone := '0' || substr(v_phone, 5); elsif v_phone like '+590%' then v_phone := '0' || substr(v_phone, 5); elsif v_phone like '+594%' then v_phone := '0' || substr(v_phone, 5); end if; if v_phone !~ '^0[1-9][0-9]{8}$' then return; end if; return query select lc.id, lc.solde_points from loyalty_customers lc where lc.phone = v_phone; end; $body$;

grant execute on function resolve_loyalty_wallet_by_phone(text) to anon, authenticated;

create or replace function mark_loyalty_wallet_added(p_id uuid) returns void language sql security definer set search_path = public as 'update loyalty_customers set wallet_added_at = now() where id = p_id and wallet_added_at is null';

grant execute on function mark_loyalty_wallet_added(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
