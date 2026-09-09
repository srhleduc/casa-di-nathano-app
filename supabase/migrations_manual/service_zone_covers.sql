-- Couverts max par service : saisie par zone (= par plan de salle room_layouts).
-- max_covers_by_layout : { "<layout_id>": 40, "<layout_id2>": 20 }.
-- {} = pas de découpage → repli sur max_covers (comportement 1 zone).
-- max_covers reste maintenu = somme des valeurs par zone (côté app).
-- Additif, non cassant. À coller dans Supabase → SQL Editor.

alter table service_templates add column if not exists max_covers_by_layout jsonb not null default '{}'::jsonb;
alter table service_overrides add column if not exists max_covers_by_layout jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
