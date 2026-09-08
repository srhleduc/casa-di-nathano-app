-- =====================================================================
-- Ruptures produits : ne plus les remettre à zéro chaque nuit.
-- Un produit noté en rupture le reste jusqu'à réactivation manuelle
-- (onglet Ruptures). On redéfinit le job 'casa-di-nathano-daily-reset'
-- (même nom => remplace) à l'identique, SANS la ligne « delete from
-- ruptures; ».
--
-- À exécuter une fois dans Supabase → SQL Editor. Corps du cron =
-- une seule chaîne '...' (les « ; » internes sont dans la chaîne).
-- =====================================================================

select cron.schedule(
  'casa-di-nathano-daily-reset',
  '0 4 * * *',
  'insert into daily_sales (restaurant_id, date, menu_item_id, qty) select o.restaurant_id, date(o.created_at), item->>''id'', sum(coalesce((item->>''qty'')::int, 1)) from orders o, jsonb_array_elements(o.items) item where date(o.created_at) < current_date and (o.scheduled_for is null or o.scheduled_for < current_date) and o.is_test = false group by o.restaurant_id, date(o.created_at), item->>''id'' on conflict (restaurant_id, date, menu_item_id) do update set qty = daily_sales.qty + excluded.qty;
   update dessert_stock set qty = 0;
   update team_config set takeaway_order_counter = 0;
   update pizza_stock set total = 0;
   delete from slots;
   delete from orders where date(created_at) < current_date and (scheduled_for is null or scheduled_for < current_date);
   insert into slots (restaurant_id, label, capacity)
     select tc.restaurant_id, to_char(t, ''HH24:MI''), tc.midi_capacity
     from team_config tc, generate_series(timestamp ''2000-01-01 12:00'', timestamp ''2000-01-01 15:00'', interval ''10 minutes'') t
     union all
     select tc.restaurant_id, to_char(t, ''HH24:MI''), tc.soir_capacity
     from team_config tc, generate_series(timestamp ''2000-01-01 18:00'', timestamp ''2000-01-01 23:50'', interval ''10 minutes'') t
     union all
     select tc.restaurant_id, ''24:00'', tc.soir_capacity
     from team_config tc
     on conflict (restaurant_id, label) do update set capacity = excluded.capacity;'
);

-- Vérif : select jobname, command from cron.job where jobname = 'casa-di-nathano-daily-reset';
