-- App livreur : comptes livreurs (email + mot de passe), limités aux livraisons
-- des restaurants. À exécuter une fois dans Supabase → SQL Editor.
--
-- Les livreurs se créent ensuite depuis Direction → Livreurs (clé SUPABASE_SERVICE_ROLE_KEY
-- requise sur le projet Vercel de la Direction). Méthode manuelle, sans l app :
--   1. Supabase → Authentication → Users → "Add user" (email + mot de passe,
--      cocher "Auto Confirm User").
--   2. Puis exécuter (en remplaçant l'email et le prénom) :
--        insert into drivers (auth_uid, name)
--        select id, 'Prénom' from auth.users where email = 'livreur@exemple.fr';

create table if not exists drivers (
  auth_uid uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
alter table drivers enable row level security;
drop policy if exists "drivers_self" on drivers;
create policy "drivers_self" on drivers for select to authenticated using (auth_uid = auth.uid());

create or replace function is_driver()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from drivers where auth_uid = auth.uid())
$$;

-- Un livreur voit uniquement les commandes en livraison (tous restaurants).
drop policy if exists "orders_driver_select" on orders;
create policy "orders_driver_select" on orders for select to authenticated
  using (is_driver() and delivery_status is not null);

-- Seule écriture permise au livreur : changer le statut de livraison.
create or replace function driver_set_delivery_status(p_order_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_name text;
begin
  select name into v_name from drivers where auth_uid = auth.uid();
  if v_name is null then
    raise exception 'Accès livreur requis';
  end if;
  if p_status not in ('a_livrer', 'en_route', 'livree') then
    raise exception 'Statut invalide';
  end if;
  update orders set
    delivery_status = p_status,
    delivery_driver = case when p_status = 'a_livrer' then null else v_name end,
    delivery_started_at = case
      when p_status = 'en_route' then now()
      when p_status = 'a_livrer' then null
      else delivery_started_at end,
    delivered_at = case when p_status = 'livree' then now() else null end
  where id = p_order_id
    and delivery_status is not null
    and delivery_status <> 'annulee';
  if not found then
    raise exception 'Livraison introuvable';
  end if;
end $$;
grant execute on function driver_set_delivery_status(uuid, text) to authenticated;
