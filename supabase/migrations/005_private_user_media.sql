/*
 * ============================================================
 * PRIVATE USER MEDIA
 * ============================================================
 *
 * The user-media bucket previously used public=true. That means
 * anyone who knows a stored object URL can retrieve the file,
 * even though INSERT/UPDATE/DELETE are restricted by RLS.
 *
 * Make the bucket private and explicitly allow authenticated
 * users to SELECT only files inside their own user-id folder.
 *
 * The frontend now uses temporary signed URLs for reads.
 */

update storage.buckets
set public = false
where id = 'user-media';


drop policy if exists "user_media_select"
on storage.objects;


create policy "user_media_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'user-media'
  and (storage.foldername(name))[1] =
      auth.uid()::text
);
