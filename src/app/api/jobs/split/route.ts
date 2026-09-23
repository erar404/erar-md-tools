import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createJob } from "@/lib/jobs";
import { callProcessor } from "@/lib/processor";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { track_id, storage_path, stems } = await request.json();
  if (!track_id || !storage_path || ![2, 4].includes(stems)) {
    return NextResponse.json(
      { error: "track_id, storage_path and stems (2 or 4) are required" },
      { status: 400 }
    );
  }

  const job = await createJob(auth.supabase, auth.user.id, "split", { storage_path, stems }, track_id);
  await callProcessor("/jobs/split", { job_id: job.id, storage_path, stems });

  return NextResponse.json({ job });
}
