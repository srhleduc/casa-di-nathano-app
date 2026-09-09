-- =====================================================================
-- Éditeur de plan de salle : unité de base = une TABLE (70 cm).
-- Avant : 1 case = 35 cm, une table = 2×2 cases. Après : 1 case = 1 table,
-- avec des demi-cases (35 cm) optionnelles pour les ajustements fins.
--
-- Seules les grilles encore vides sont repassées en 70 cm (aucun plan réel
-- n'a été dessiné). Une éventuelle grille non vide garde son cell_size_cm et
-- reste interprétée correctement (le moteur détaille toujours en 35 cm).
-- À coller dans Supabase → SQL Editor.
-- =====================================================================

alter table room_layouts alter column cell_size_cm set default 70;

update room_layouts set cell_size_cm = 70
where jsonb_typeof(cells) is null
   or cells = '[]'::jsonb
   or (jsonb_typeof(cells) = 'array' and jsonb_array_length(cells) = 0);

notify pgrst, 'reload schema';
