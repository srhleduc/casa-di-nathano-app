-- Zone (plan de salle) ouverte / fermée — interrupteur rapide au jour le jour
-- (ex. fermer la terrasse s'il pleut). Persistant : reste fermée jusqu'à
-- réouverture par l'équipe. Une zone fermée n'est plus proposée sur /reserver
-- et ses tables sont retirées du moteur de réservation.
-- Additif, non cassant. À coller dans Supabase → SQL Editor.

alter table room_layouts add column if not exists active boolean not null default true;

notify pgrst, 'reload schema';
