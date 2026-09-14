-- Retire la génération figée des créneaux (12h-15h / 18h-minuit, identique
-- tous les jours pour tout le monde) du job "casa-di-nathano-daily-reset",
-- et la remplace par un appel à la nouvelle Edge Function
-- generate-daily-slots (horaires réels du jour, par établissement — voir
-- takeaway_hours / TakeawayHoursAdmin.jsx), programmé juste après (04:01).

select cron.schedule(
  'casa-di-nathano-daily-reset',
  '0 4 * * *',
  $$
    insert into daily_sales (restaurant_id, date, menu_item_id, qty)
    select o.restaurant_id, date(o.created_at), item->>'id', sum(coalesce((item->>'qty')::int, 1))
    from orders o, jsonb_array_elements(o.items) item
    where date(o.created_at) < current_date
      and (o.scheduled_for is null or o.scheduled_for < current_date)
      and o.is_test = false
    group by o.restaurant_id, date(o.created_at), item->>'id'
    on conflict (restaurant_id, date, menu_item_id)
      do update set qty = daily_sales.qty + excluded.qty;

    update dessert_stock set qty = 0;
    update team_config set takeaway_order_counter = 0;
    update pizza_stock set total = 0;
    delete from orders where date(created_at) < current_date and (scheduled_for is null or scheduled_for < current_date);
  $$
);

select cron.schedule(
  'generate-daily-slots',
  '1 4 * * *',
  $$
    select net.http_post(
      url := 'https://tvuqyrkomuwlapevgekv.functions.supabase.co/generate-daily-slots'
    );
  $$
);

-- Pour désactiver plus tard : select cron.unschedule('generate-daily-slots');
