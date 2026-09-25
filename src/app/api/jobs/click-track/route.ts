import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { checkJobCapacity, createJob } from "@/lib/jobs";
import { callProcessor } from "@/lib/processor";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    track_id,
    storage_path,
    bpm,
    time_signature,
    accent,
    tempo_multiplier,
    merge_with_source,
  } = await request.json();

  if (!track_id || !bpm || !time_signature) {
    return NextResponse.json(
      { error: "track_id, bpm and time_signature are required" },
      { status: 400 }
    );
  }

  const capacityError = await checkJobCapacity(auth.supabase, auth.user.id);
  if (capacityError) return capacityError;

  const params = {
    storage_path: merge_with_source ? storage_path : undefined,
    bpm,
    time_signature,
    accent: Boolean(accent),
    tempo_multiplier: tempo_multiplier ?? 1,
    merge_with_source: Boolean(merge_with_source),
  };

  const job = await createJob(auth.supabase, auth.user.id, "click_track", params, track_id);
  await callProcessor("/jobs/click-track", { job_id: job.id, ...params });

  return NextResponse.json({ job });
}
