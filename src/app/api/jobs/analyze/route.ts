import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createJob } from "@/lib/jobs";
import { callProcessor } from "@/lib/processor";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { track_id, storage_path } = await request.json();
  if (!track_id || !storage_path) {
    return NextResponse.json({ error: "track_id and storage_path are required" }, { status: 400 });
  }

  const job = await createJob(auth.supabase, auth.user.id, "analyze", { storage_path }, track_id);
  await callProcessor("/jobs/analyze", { job_id: job.id, storage_path });

  return NextResponse.json({ job });
}
