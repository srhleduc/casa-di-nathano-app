-- La Direction (managers) peut désormais AGIR dans l'espace équipe de chaque
-- restaurant (plus de vue « en lecture seule »), en plus de ses accès propres.
-- Jusqu'ici ces tables n'autorisaient l'écriture qu'au compte fixe du
-- restaurant (restaurant_id = my_restaurant_id()). On ajoute « or is_manager() »
-- sans toucher aux droits existants : le compte du restaurant garde exactement
-- les mêmes droits.
-- À exécuter une fois dans le SQL editor Supabase (idempotent : relançable).

do $$
declare
  p record;
  new_using text;
  new_check text;
begin
  for p in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (tablename, policyname) in (
        ('orders', 'orders_write'),
        ('order_commitments', 'order_commitments_write'),
        ('slots', 'slots_write'),
        ('ruptures', 'ruptures_write'),
        ('dessert_stock', 'dessert_stock_write'),
        ('pizza_stock', 'pizza_stock_write'),
        ('test_mode', 'test_mode_write'),
        ('team_config', 'team_config_write'),
        ('table_plan', 'table_plan_write'),
        ('tables', 'tables_write'),
        ('table_combinations', 'table_combinations_write'),
        ('room_layouts', 'room_layouts_write'),
        ('circulation_constraints', 'circulation_constraints_write'),
        ('reservations', 'reservations_write'),
        ('reservation_table_assignments', 'reservation_table_assignments_write'),
        ('staff', 'staff_write'),
        ('staff_shifts', 'staff_shifts_write'),
        ('pointage_entries', 'pointage_entries_insert')
      )
  loop
    -- Déjà fait (relance) : on ne double pas la condition.
    if coalesce(p.qual, '') ilike '%is_manager%' or coalesce(p.with_check, '') ilike '%is_manager%' then
      continue;
    end if;
    new_using := case when p.qual is null then null else format('(%s) or is_manager()', p.qual) end;
    new_check := case when p.with_check is null then null else format('(%s) or is_manager()', p.with_check) end;
    if new_using is not null and new_check is not null then
      execute format('alter policy %I on public.%I using (%s) with check (%s)', p.policyname, p.tablename, new_using, new_check);
    elsif new_using is not null then
      execute format('alter policy %I on public.%I using (%s)', p.policyname, p.tablename, new_using);
    else
      execute format('alter policy %I on public.%I with check (%s)', p.policyname, p.tablename, new_check);
    end if;
  end loop;
end $$;

-- Numéro de commande à emporter quand c'est la Direction qui saisit : le
-- compte manager n'a pas de restaurant propre, donc next_takeaway_number()
-- (qui se base sur my_restaurant_id()) ne lui renverrait rien. Cette variante
-- prend le restaurant en paramètre, et n'est utilisable que par un manager.
create or replace function next_takeaway_number_for(p_restaurant_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num integer;
begin
  if not is_manager() then
    raise exception 'réservé à la Direction';
  end if;
  update team_config
  set takeaway_order_counter = (takeaway_order_counter % 99) + 1
  where restaurant_id = p_restaurant_id
  returning takeaway_order_counter into v_num;
  return v_num;
end;
$$;

grant execute on function next_takeaway_number_for(text) to authenticated;
