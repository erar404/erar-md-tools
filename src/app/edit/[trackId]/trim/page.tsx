"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2Icon, PauseIcon, PlayIcon } from "lucide-react";
import { toast } from "sonner";
import WaveSurfer from "wavesurfer.js";
import Hover from "wavesurfer.js/plugins/hover";
import RegionsPlugin, { type Region } from "wavesurfer.js/plugins/regions";
import { useTrackAudio } from "@/components/edit/track-audio-provider";
import { JobStatusButton } from "@/components/edit/job-status-button";
import { createClient } from "@/lib/supabase/client";
import { createSignedDownloadUrl } from "@/lib/storage-client";
import { formatMsTime } from "@/lib/format-time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Job } from "@/types/database";

const REGION_COLOR = "rgba(239, 68, 68, 0.2)";
const MIN_LENGTH_MS = 10;

interface TrimResult {
  storage_path: string;
}

export default function TrimPage() {
  const { track, audioRef, audioUrl } = useTrackAudio();
  const [supabase] = useState(() => createClient());

  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionRef = useRef<Region | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(0);

  const [job, setJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!audioUrl || !audioRef.current || !containerRef.current) return;

    const regions = RegionsPlugin.create();
    const hover = Hover.create({ formatTimeCallback: formatMsTime });
    const ws = WaveSurfer.create({
      container: containerRef.current,
      media: audioRef.current,
      waveColor: "#a1a1aa",
      progressColor: "#ef4444",
      cursorColor: "#ef4444",
      height: 96,
      plugins: [regions, hover],
    });
    wavesurferRef.current = ws;

    ws.on("ready", (duration) => {
      setIsReady(true);
      setDurationMs(Math.round(duration * 1000));
      const region = regions.addRegion({
        start: 0,
        end: duration,
        color: REGION_COLOR,
        drag: true,
        resize: true,
      });
      regionRef.current = region;
      setStartMs(0);
      setEndMs(Math.round(duration * 1000));
    });
    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));

    regions.on("region-updated", (region) => {
      setStartMs(Math.round(region.start * 1000));
      setEndMs(Math.round(region.end * 1000));
    });

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
      regionRef.current = null;
      setIsReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  // Live job status instead of polling — same pattern as the landing flow.
  useEffect(() => {
    if (!job || job.status === "done" || job.status === "error") return;

    const channel = supabase
      .channel(`job-${job.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${job.id}` },
        (payload) => setJob(payload.new as Job)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [job, supabase]);

  function handleStartChange(value: number) {
    const clamped = Math.min(Math.max(0, value), endMs - MIN_LENGTH_MS);
    setStartMs(clamped);
    regionRef.current?.setOptions({ start: clamped / 1000 });
  }

  function handleEndChange(value: number) {
    const clamped = Math.max(Math.min(durationMs, value), startMs + MIN_LENGTH_MS);
    setEndMs(clamped);
    regionRef.current?.setOptions({ end: clamped / 1000 });
  }

  async function handleDownloadTrim() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/jobs/trim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track_id: track.id,
          storage_path: track.storage_path,
          start_ms: startMs,
          end_ms: endMs,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Trim failed to start");
      setJob(data.job as Job);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Trim failed to start");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownloadResult() {
    if (!job?.result) return;
    setDownloading(true);
    try {
      const result = job.result as unknown as TrimResult;
      window.location.href = await createSignedDownloadUrl(supabase, result.storage_path);
    } catch {
      toast.error("Could not create a download link");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trimmer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div ref={containerRef} className="rounded-md border bg-muted/30 p-2" />
        {!isReady && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading waveform…
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!isReady}
            onClick={() => wavesurferRef.current?.playPause()}
          >
            {isPlaying ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
          </Button>
          <span className="text-sm text-muted-foreground">
            Selection: {formatMsTime(startMs / 1000)} – {formatMsTime(endMs / 1000)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="trim-start">Start (ms)</Label>
            <Input
              id="trim-start"
              type="number"
              min={0}
              max={endMs - MIN_LENGTH_MS}
              value={startMs}
              disabled={!isReady}
              onChange={(e) => handleStartChange(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trim-end">End (ms)</Label>
            <Input
              id="trim-end"
              type="number"
              min={startMs + MIN_LENGTH_MS}
              max={durationMs}
              value={endMs}
              disabled={!isReady}
              onChange={(e) => handleEndChange(Number(e.target.value))}
            />
          </div>
        </div>

        {job?.status === "done" ? (
          <Button onClick={handleDownloadResult} disabled={downloading} className="w-full">
            {downloading ? "Preparing…" : "Download trimmed file"}
          </Button>
        ) : (
          <JobStatusButton
            job={job}
            onStart={handleDownloadTrim}
            submitting={submitting}
            disabled={!isReady}
            idleLabel="Download trim"
            processingLabel="Trimming…"
          />
        )}
      </CardContent>
    </Card>
  );
}
