import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createJob } from "@/lib/jobs";
import { callProcessor } from "@/lib/processor";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { youtube_url, format } = await request.json();
  if (!youtube_url || !format) {
    return NextResponse.json({ error: "youtube_url and format are required" }, { status: 400 });
  }

  const job = await createJob(auth.supabase, auth.user.id, "download", { youtube_url, format });
  await callProcessor("/jobs/download", { job_id: job.id, youtube_url, format });

  return NextResponse.json({ job });
}
