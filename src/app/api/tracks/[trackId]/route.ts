import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import type { Job, Track, TrackStem } from "@/types/database";

/** Every `storage_path` in the DB is "<bucket>/<user_id>/..." — bucket is
 * always the first segment (same convention as storage-client.ts and the
 * processor's storage.py). */
function splitStoragePath(storagePath: string): [bucket: string, key: string] {
  const [bucket, ...rest] = storagePath.split("/");
  return [bucket, rest.join("/")];
}

/** Job results carry their own output file(s) — a flat `storage_path` for
 * trim/click_track/mixdown, or a `stems` map for split — that aren't tracked
 * anywhere else, so they'd otherwise be orphaned once the track row (and its
 * cascade-deleted job rows) are gone. */
function collectResultStoragePaths(result: Job["result"]): string[] {
  if (!result) return [];
  const paths: string[] = [];
  if (typeof result.storage_path === "string") paths.push(result.storage_path);
  const stems = result.stems;
  if (stems && typeof stems === "object") {
    for (const value of Object.values(stems as Record<string, unknown>)) {
      if (typeof value === "string") paths.push(value);
    }
  }
  return paths;
}

/** Permanently discards a session: removes every file this track's jobs ever
 * produced (source upload, trims, click tracks, stems, mixdowns) from
 * storage, then deletes the track row — jobs and track_stems rows cascade
 * via their FK (ON DELETE CASCADE), all RLS-scoped to the caller's own rows. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase } = auth;

  const { trackId } = await params;

  const { data: track, error: trackError } = await supabase
    .from("tracks")
    .select("*")
    .eq("id", trackId)
    .single();
  if (trackError || !track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const [{ data: jobs }, { data: stems }] = await Promise.all([
    supabase.from("jobs").select("*").eq("track_id", trackId),
    supabase.from("track_stems").select("*").eq("track_id", trackId),
  ]);

  const storagePaths = new Set<string>([(track as Track).storage_path]);
  for (const job of (jobs ?? []) as Job[]) {
    for (const path of collectResultStoragePaths(job.result)) storagePaths.add(path);
  }
  for (const stem of (stems ?? []) as TrackStem[]) storagePaths.add(stem.storage_path);

  const keysByBucket = new Map<string, string[]>();
  for (const path of storagePaths) {
    const [bucket, key] = splitStoragePath(path);
    if (!bucket || !key) continue;
    keysByBucket.set(bucket, [...(keysByBucket.get(bucket) ?? []), key]);
  }

  for (const [bucket, keys] of keysByBucket) {
    const { error } = await supabase.storage.from(bucket).remove(keys);
    // An orphaned file is a smaller problem than a user unable to discard a
    // track, so a storage cleanup failure is logged, not fatal to the request.
    if (error) {
      console.error(`Failed to remove ${keys.length} object(s) from "${bucket}":`, error.message);
    }
  }

  const { error: deleteError } = await supabase.from("tracks").delete().eq("id", trackId);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
