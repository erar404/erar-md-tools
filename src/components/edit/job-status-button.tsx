"use client";

import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Job } from "@/types/database";

// Shared idle/pending/processing/error rendering for the Trim/Metronome/Split
// tabs' job-triggering buttons — each tab still owns its own "done" UI, since
// that varies (one download vs. two, etc).
export function JobStatusButton({
  job,
  onStart,
  submitting,
  disabled = false,
  idleLabel,
  processingLabel,
  className = "w-full",
}: {
  job: Job | null;
  onStart: () => void;
  submitting: boolean;
  disabled?: boolean;
  idleLabel: string;
  processingLabel: string;
  className?: string;
}) {
  if (job && job.status !== "done" && job.status !== "error") {
    return (
      <Button disabled className={className}>
        <Loader2Icon className="size-4 animate-spin" />
        {job.status === "pending" ? "Queued…" : processingLabel}
      </Button>
    );
  }

  return (
    <>
      <Button onClick={onStart} disabled={submitting || disabled} className={className}>
        {submitting ? "Starting…" : idleLabel}
      </Button>
      {job?.status === "error" && (
        <p className="mt-2 text-sm text-destructive">
          {job.error_message ?? "Something went wrong."}
        </p>
      )}
    </>
  );
}
