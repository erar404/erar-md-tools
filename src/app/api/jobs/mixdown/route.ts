import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { checkJobCapacity, createJob } from "@/lib/jobs";
import { callProcessor } from "@/lib/processor";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { track_id, stems } = await request.json();
  if (!track_id || !Array.isArray(stems) || stems.length === 0) {
    return NextResponse.json(
      { error: "track_id and a non-empty stems array are required" },
      { status: 400 }
    );
  }

  const capacityError = await checkJobCapacity(auth.supabase, auth.user.id);
  if (capacityError) return capacityError;

  const job = await createJob(auth.supabase, auth.user.id, "mixdown", { stems }, track_id);
  await callProcessor("/jobs/mixdown", { job_id: job.id, stems });

  return NextResponse.json({ job });
}
