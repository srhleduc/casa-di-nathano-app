-- Lie une commande sur place à la réservation qu'elle honore (T1 → Nadine).
-- Renseigné automatiquement à la prise de commande quand une table de la
-- commande correspond à une réservation confirmée du jour ; sert à marquer la
-- réservation « arrivée », puis « terminée » à l'encaissement, et à pré-remplir
-- la fidélité en caisse avec le numéro de la réservation.
-- Additif, non cassant. À coller dans Supabase → SQL Editor.

alter table orders add column if not exists reservation_id uuid references reservations (id) on delete set null;

notify pgrst, 'reload schema';
