import type { SupabaseClient } from "@supabase/supabase-js";

/** Every `storage_path` in the DB is "<bucket>/<user_id>/..." — bucket is always the first segment. */
export async function createSignedDownloadUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds = 3600
): Promise<string> {
  const [bucket, ...rest] = storagePath.split("/");
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(rest.join("/"), expiresInSeconds);
  if (error || !data) throw error ?? new Error("Could not create a download link");
  return data.signedUrl;
}
