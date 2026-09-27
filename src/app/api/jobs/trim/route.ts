import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { checkJobCapacity, createJob, markJobError } from "@/lib/jobs";
import { callProcessor } from "@/lib/processor";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { track_id, storage_path, start_ms, end_ms } = await request.json();
  if (!track_id || !storage_path || start_ms == null || end_ms == null) {
    return NextResponse.json(
      { error: "track_id, storage_path, start_ms and end_ms are required" },
      { status: 400 }
    );
  }
  if (end_ms <= start_ms) {
    return NextResponse.json({ error: "end_ms must be greater than start_ms" }, { status: 400 });
  }

  const capacityError = await checkJobCapacity(auth.supabase, auth.user.id);
  if (capacityError) return capacityError;

  const job = await createJob(
    auth.supabase,
    auth.user.id,
    "trim",
    { storage_path, start_ms, end_ms },
    track_id
  );
  try {
    await callProcessor("/jobs/trim", { job_id: job.id, storage_path, start_ms, end_ms });
  } catch (err) {
    await markJobError(auth.supabase, job.id, err instanceof Error ? err.message : "Failed to reach the processor");
    return NextResponse.json({ error: "Could not reach the processor — try again shortly." }, { status: 502 });
  }

  return NextResponse.json({ job });
}
