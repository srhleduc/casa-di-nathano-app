-- Suivi de commande par email : jeton de suivi + email facultatif du client.
-- tracking_token : identifiant secret (UUID aléatoire) mis dans le lien du mail ;
-- la page /suivi/<jeton> n'expose que le statut de CETTE commande (voir
-- app/api/suivi/route.js, clé service_role côté serveur uniquement).
-- Idempotent.

alter table orders add column if not exists customer_email text;
alter table orders add column if not exists tracking_token uuid not null default gen_random_uuid();
create unique index if not exists orders_tracking_token_idx on orders (tracking_token);

notify pgrst, 'reload schema';
