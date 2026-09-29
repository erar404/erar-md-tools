import type { SupabaseClient } from "@supabase/supabase-js";

/** Every `storage_path` in the DB is "<bucket>/<user_id>/..." — bucket is always the first segment.
 *
 * Passes Supabase's `download` option so the signed URL's response carries
 * `Content-Disposition: attachment` — navigating to it (or `<a href>`)
 * triggers the browser's native Save As flow instead of just opening/playing
 * the audio file in the tab. `filename` overrides the suggested save name;
 * omit it to keep whatever the storage path's basename already is. */
export async function createSignedDownloadUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds = 3600,
  filename?: string
): Promise<string> {
  const [bucket, ...rest] = storagePath.split("/");
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(rest.join("/"), expiresInSeconds, { download: filename ?? true });
  if (error || !data) throw error ?? new Error("Could not create a download link");
  return data.signedUrl;
}

/** Avatars live in the public `avatars` bucket at "<ownerPath>/avatar" (no
 * extension — Content-Type comes from the upload, not the filename), always
 * `upsert`ed in place so re-uploading never leaves an orphaned old file
 * behind. The returned URL carries a `?v=` cache-buster so an <img> showing
 * the old photo actually refreshes, since the underlying path never changes. */
export async function uploadAvatar(
  supabase: SupabaseClient,
  ownerPath: string,
  file: File
): Promise<string> {
  const path = `${ownerPath}/avatar`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function removeAvatar(supabase: SupabaseClient, ownerPath: string): Promise<void> {
  const { error } = await supabase.storage.from("avatars").remove([`${ownerPath}/avatar`]);
  if (error) throw error;
}
