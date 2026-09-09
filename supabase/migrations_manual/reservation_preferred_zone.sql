-- /reserver : zone (plan de salle) choisie par le client.
-- preferred_layout_id : room_layouts.id souhaité (null = pas de préférence :
-- walk-in équipe, anciennes réservations, resto mono-zone).
-- Le moteur restreint l'affectation de cette réservation aux tables de la zone.
-- Additif, non cassant. À coller dans Supabase → SQL Editor.

alter table reservations add column if not exists preferred_layout_id uuid references room_layouts (id) on delete set null;

notify pgrst, 'reload schema';
