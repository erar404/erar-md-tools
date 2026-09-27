"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job } from "@/types/database";
import { explainJobError } from "@/lib/job-error";

/** Subscribes to Realtime updates for a job and keeps `job` in sync, the
 * pattern used by every tab and the landing flow. Also closes a real race:
 * a job can finish (or error) between `createJob()` returning and this
 * subscription actually going live — Realtime only pushes *future* changes,
 * so a fast failure (e.g. yt-dlp rejecting a format almost instantly) could
 * land in that gap and never reach the client, leaving the UI stuck showing
 * "processing" forever even though the row is already `error` in the DB.
 * Once subscribed, we re-fetch the row once to catch anything missed, and
 * surface a toast the first time a job is observed to have failed. */
export function useJobStatus(
  supabase: SupabaseClient,
  job: Job | null,
  setJob: (job: Job) => void
) {
  const notifiedErrorIds = useRef(new Set<string>());

  useEffect(() => {
    if (job?.status === "error" && !notifiedErrorIds.current.has(job.id)) {
      notifiedErrorIds.current.add(job.id);
      const { summary, cause } = explainJobError(job.error_message);
      toast.error(summary, cause ? { description: cause } : undefined);
    }
  }, [job?.id, job?.status, job?.error_message]);

  useEffect(() => {
    if (!job || job.status === "done" || job.status === "error") return;

    let cancelled = false;
    const channel = supabase
      .channel(`job-${job.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${job.id}` },
        (payload) => setJob(payload.new as Job)
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED" || cancelled) return;
        // Reconcile once the channel is actually live, in case the job
        // already reached a terminal state in the gap before we could
        // start listening.
        supabase
          .from("jobs")
          .select("*")
          .eq("id", job.id)
          .single()
          .then(({ data }) => {
            if (data && !cancelled) setJob(data as Job);
          });
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [job, supabase, setJob]);
}
