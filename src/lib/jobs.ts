import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job, JobType } from "@/types/database";

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
