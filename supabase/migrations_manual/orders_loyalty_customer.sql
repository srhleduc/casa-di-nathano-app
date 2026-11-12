-- Rattache une commande à un compte fidélité dès la prise de commande (ou sa
-- modification) par l'équipe : bouton loupe à côté du nom du client. Les points
-- ne sont PAS crédités à ce moment-là (le total peut encore changer) : en
-- Caisse, le compte est pré-sélectionné et un tap suffit pour créditer
-- floor(total) points (award_loyalty_points, inchangé).
-- Additif, non cassant. À coller dans Supabase → SQL Editor AVANT de déployer
-- le code qui s'en sert.

alter table orders add column if not exists loyalty_customer_id uuid references loyalty_customers (id) on delete set null;

notify pgrst, 'reload schema';
