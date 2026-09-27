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
