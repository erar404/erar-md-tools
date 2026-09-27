import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { checkJobCapacity, createJob, markJobError } from "@/lib/jobs";
import { callProcessor } from "@/lib/processor";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { youtube_url, format, quality } = await request.json();
  if (!youtube_url || !format) {
    return NextResponse.json({ error: "youtube_url and format are required" }, { status: 400 });
  }

  const capacityError = await checkJobCapacity(auth.supabase, auth.user.id);
  if (capacityError) return capacityError;

  const job = await createJob(auth.supabase, auth.user.id, "download", { youtube_url, format, quality });
  try {
    await callProcessor("/jobs/download", { job_id: job.id, youtube_url, format, quality });
  } catch (err) {
    await markJobError(auth.supabase, job.id, err instanceof Error ? err.message : "Failed to reach the processor");
    return NextResponse.json({ error: "Could not reach the processor — try again shortly." }, { status: 502 });
  }

  return NextResponse.json({ job });
}
