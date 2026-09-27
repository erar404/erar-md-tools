import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job, JobType } from "@/types/database";

const MAX_CONCURRENT_JOBS_PER_USER = 3;

/** Small-team scope, but still worth a basic cap so one user's queue of
 * downloads/splits can't starve everyone else's. Call before createJob. */
export async function checkJobCapacity(supabase: SupabaseClient, userId: string) {
  const { count, error } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["pending", "processing"]);

  if (error) throw error;
  if ((count ?? 0) >= MAX_CONCURRENT_JOBS_PER_USER) {
    return NextResponse.json(
      {
        error: `You have ${MAX_CONCURRENT_JOBS_PER_USER} jobs already in progress — wait for one to finish before starting another.`,
      },
      { status: 429 }
    );
  }
  return null;
}

export async function createJob(
  supabase: SupabaseClient,
  userId: string,
  type: JobType,
  params: Record<string, unknown>,
  trackId?: string
) {
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      user_id: userId,
      track_id: trackId ?? null,
      type,
      status: "pending",
      params,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Job;
}

/** Only the processor (service-role) normally transitions a job past "pending".
 * If the request to reach it never lands — network error, misconfigured
 * PROCESSOR_BASE_URL, etc. — the job would otherwise sit at "pending" forever,
 * permanently consuming one of the caller's `checkJobCapacity` slots. Call this
 * from the route's catch block so a dispatch failure surfaces as a real error. */
export async function markJobError(supabase: SupabaseClient, jobId: string, message: string) {
  await supabase.from("jobs").update({ status: "error", error_message: message }).eq("id", jobId);
}
