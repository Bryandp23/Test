-- EPHEC Content Studio — migration 2 (storage). Généré depuis lib/server/migrations.ts

insert into storage.buckets (id, name, public, file_size_limit)
values ('studio-files', 'studio-files', false, null)
on conflict (id) do update set public = false;

drop policy if exists "studio_files_select" on storage.objects;

create policy "studio_files_select" on storage.objects for select to authenticated
using (bucket_id = 'studio-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "studio_files_insert" on storage.objects;

create policy "studio_files_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'studio-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "studio_files_update" on storage.objects;

create policy "studio_files_update" on storage.objects for update to authenticated
using (bucket_id = 'studio-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "studio_files_delete" on storage.objects;

create policy "studio_files_delete" on storage.objects for delete to authenticated
using (bucket_id = 'studio-files' and (storage.foldername(name))[1] = auth.uid()::text);
