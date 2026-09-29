"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createSignedDownloadUrl } from "@/lib/storage-client";
import { Button } from "@/components/ui/button";
import { explainJobError } from "@/lib/job-error";
import type { Job } from "@/types/database";

interface DownloadResult {
  storage_path: string;
  title: string;
  filename: string;
  duration_seconds: number | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DownloadJobRow({ job }: { job: Job }) {
  const [downloading, setDownloading] = useState(false);
  const params = job.params as { youtube_url?: string; format?: string };
  const result = job.status === "done" ? (job.result as unknown as DownloadResult) : null;

  async function handleDownload() {
    if (!result) return;
    setDownloading(true);
    try {
      const supabase = createClient();
      window.location.href = await createSignedDownloadUrl(
        supabase,
        result.storage_path,
        undefined,
        result.filename
      );
    } catch {
      toast.error("Could not create a download link — the file may have expired.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{result?.title ?? params.youtube_url ?? "Download"}</p>
        <p className="text-xs text-muted-foreground">
          {(params.format ?? "").toUpperCase()} · {formatDate(job.created_at)}
        </p>
        {job.status === "error" && (
          <p className="mt-1 text-xs text-destructive">{explainJobError(job.error_message).summary}</p>
        )}
      </div>
      {job.status === "done" && result ? (
        <Button size="sm" variant="outline" onClick={handleDownload} loading={downloading}>
          {downloading ? "Preparing…" : "Download"}
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground capitalize">{job.status}</span>
      )}
    </li>
  );
}
