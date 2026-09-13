-- Renomme le bucket de stockage "notification-sounds" en "chime-sounds".
-- Raison : le mot "notification" dans l'URL du fichier (/storage/v1/object/
-- notification-sounds/...) est bloqué par certaines listes de filtrage des
-- bloqueurs de pub/vie privée (ex. EasyList "Fanboy's Notification Blocking
-- List", qui cible justement les URLs contenant "notification" à cause des
-- popups de demande d'autorisation web push) — provoque un échec silencieux
-- côté navigateur ("Failed to fetch") sans que la policy RLS ne soit même
-- atteinte. Le bucket était vide (aucun fichier réel encore importé).

-- (le bucket "notification-sounds" lui-même n'est pas supprimable en SQL
-- direct — protection Supabase ; il reste, vide et inutilisé, sans policies.)
drop policy if exists "notification_sounds_public_read" on storage.objects;
drop policy if exists "notification_sounds_authenticated_write" on storage.objects;
drop policy if exists "notification_sounds_authenticated_update" on storage.objects;
drop policy if exists "notification_sounds_authenticated_delete" on storage.objects;

insert into storage.buckets (id, name, public)
values ('chime-sounds', 'chime-sounds', true)
on conflict (id) do nothing;

create policy "chime_sounds_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'chime-sounds');

create policy "chime_sounds_authenticated_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chime-sounds');

create policy "chime_sounds_authenticated_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'chime-sounds');

create policy "chime_sounds_authenticated_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'chime-sounds');
