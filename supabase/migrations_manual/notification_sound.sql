-- Son de notification "commande autonome" personnalisable par établissement,
-- importé depuis l'espace Direction (remplace le carillon par défaut généré
-- en direct dans lib/sound.js). Voir components/direction/NotificationSoundAdmin.jsx.

alter table restaurants add column if not exists notification_sound_url text;

insert into storage.buckets (id, name, public)
values ('notification-sounds', 'notification-sounds', true)
on conflict (id) do nothing;

create policy "notification_sounds_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'notification-sounds');

create policy "notification_sounds_authenticated_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'notification-sounds');

create policy "notification_sounds_authenticated_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'notification-sounds');

create policy "notification_sounds_authenticated_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'notification-sounds');
