create table if not exists wallet_callback_events (nonce text primary key, object_id text not null, event_type text not null, received_at timestamptz not null default now());

alter table wallet_callback_events enable row level security;

create or replace function apply_wallet_callback(p_object_id text, p_event text, p_nonce text) returns text language plpgsql security definer set search_path = public as $body$ declare v_prefix constant text := '3388000000023181954.casa_loyalty_'; v_id_txt text; v_id uuid; v_rows integer; begin if p_nonce is null or btrim(p_nonce) = '' then return 'ignored'; end if; insert into wallet_callback_events (nonce, object_id, event_type) values (p_nonce, coalesce(p_object_id, ''), coalesce(p_event, '')) on conflict (nonce) do nothing; get diagnostics v_rows = row_count; if v_rows = 0 then return 'duplicate'; end if; delete from wallet_callback_events where received_at < now() - interval '30 days'; if p_object_id is null or left(p_object_id, length(v_prefix)) <> v_prefix then return 'unknown_object'; end if; v_id_txt := substr(p_object_id, length(v_prefix) + 1); begin v_id := v_id_txt::uuid; exception when others then return 'unknown_object'; end; if p_event = 'save' then update loyalty_customers set wallet_added_at = now() where id = v_id; elsif p_event = 'del' then update loyalty_customers set wallet_added_at = null where id = v_id; else return 'ignored'; end if; get diagnostics v_rows = row_count; if v_rows = 0 then return 'unknown_object'; end if; return 'applied'; end; $body$;

grant execute on function apply_wallet_callback(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
