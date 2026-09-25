"use client";

import { useEffect, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";
import { toast } from "sonner";
import { useTrackAudio } from "@/components/edit/track-audio-provider";
import { JobStatusButton } from "@/components/edit/job-status-button";
import { createClient } from "@/lib/supabase/client";
import { createSignedDownloadUrl } from "@/lib/storage-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Job } from "@/types/database";

const TIME_SIGNATURES = ["2/4", "3/4", "4/4", "5/4", "6/8"] as const;
const DEFAULT_BPM = 120;
const MIN_MULTIPLIER = 0.25;
const MAX_MULTIPLIER = 4;
const MAX_TAP_INTERVAL_MS = 2000;
const MAX_TAPS = 8;

interface ClickTrackResult {
  click_storage_path: string;
  merged_storage_path?: string;
}

export default function MetronomePage() {
  const { track, audioRef } = useTrackAudio();
  const [supabase] = useState(() => createClient());

  const [tapBpm, setTapBpm] = useState<number | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [timeSignature, setTimeSignature] = useState(
    (track.analyzed_time_signature as (typeof TIME_SIGNATURES)[number] | null) ?? "4/4"
  );
  const [noAccent, setNoAccent] = useState(false);
  const [isTrackPlaying, setIsTrackPlaying] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  const [job, setJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState<"click" | "merged" | null>(null);

  const tapTimestampsRef = useRef<number[]>([]);

  const baseBpm = tapBpm ?? track.analyzed_tempo ?? DEFAULT_BPM;
  const effectiveBpm = Math.round(baseBpm * multiplier * 10) / 10;
  const beatsPerBar = parseInt(timeSignature.split("/")[0], 10);

  // Preview scheduler reads these refs so it doesn't need to be torn down
  // and restarted every time a control changes mid-playback.
  const bpmRef = useRef(effectiveBpm);
  const beatsPerBarRef = useRef(beatsPerBar);
  const noAccentRef = useRef(noAccent);
  useEffect(() => {
    bpmRef.current = effectiveBpm;
  }, [effectiveBpm]);
  useEffect(() => {
    beatsPerBarRef.current = beatsPerBar;
  }, [beatsPerBar]);
  useEffect(() => {
    noAccentRef.current = noAccent;
  }, [noAccent]);

  // Tap-tempo is only meaningful while the source is playing, so the button
  // tracks the shared <audio> element's play state instead of its own.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onPlay = () => setIsTrackPlaying(true);
    const onPause = () => setIsTrackPlaying(false);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onPause);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onPause);
    };
  }, [audioRef]);

  // Live job status instead of polling — same pattern as trim/landing.
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

  // Client-side Web Audio preview — separate from the server-rendered
  // downloads, so the user can audition tempo/accent changes instantly.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const nextNoteTimeRef = useRef(0);
  const currentBeatRef = useRef(0);

  function scheduleClick(beatNumber: number, time: number, ctx: AudioContext) {
    const isAccent = beatNumber % beatsPerBarRef.current === 0 && !noAccentRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = isAccent ? 1400 : 900;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(isAccent ? 0.6 : 0.35, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  function scheduler() {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    while (nextNoteTimeRef.current < ctx.currentTime + 0.1) {
      scheduleClick(currentBeatRef.current, nextNoteTimeRef.current, ctx);
      nextNoteTimeRef.current += 60 / bpmRef.current;
      currentBeatRef.current += 1;
    }
    timerRef.current = window.setTimeout(scheduler, 25);
  }

  function stopPreview() {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    void audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setIsPreviewPlaying(false);
  }

  function togglePreview() {
    if (isPreviewPlaying) {
      stopPreview();
      return;
    }
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    nextNoteTimeRef.current = ctx.currentTime + 0.05;
    currentBeatRef.current = 0;
    setIsPreviewPlaying(true);
    scheduler();
  }

  useEffect(() => stopPreview, []);

  function handleTap() {
    const now = performance.now();
    const taps = tapTimestampsRef.current;
    if (taps.length > 0 && now - taps[taps.length - 1] > MAX_TAP_INTERVAL_MS) {
      taps.length = 0;
    }
    taps.push(now);
    if (taps.length > MAX_TAPS) taps.shift();
    if (taps.length < 2) return;

    const intervals = taps.slice(1).map((t, i) => t - taps[i]);
    const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    setTapBpm(Math.round((60000 / avgMs) * 10) / 10);
    setMultiplier(1);
  }

  async function handleGenerate() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/jobs/click-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track_id: track.id,
          storage_path: track.storage_path,
          bpm: baseBpm,
          tempo_multiplier: multiplier,
          time_signature: timeSignature,
          accent: !noAccent,
          merge_with_source: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Click track generation failed to start");
      setJob(data.job as Job);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Click track generation failed to start");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownload(kind: "click" | "merged", storagePath: string) {
    setDownloading(kind);
    try {
      window.location.href = await createSignedDownloadUrl(supabase, storagePath);
    } catch {
      toast.error("Could not create a download link");
    } finally {
      setDownloading(null);
    }
  }

  const result = job?.status === "done" ? (job.result as unknown as ClickTrackResult) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metronome Generator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={togglePreview}
            aria-label={isPreviewPlaying ? "Stop preview" : "Play preview"}
          >
            {isPreviewPlaying ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
          </Button>
          <div>
            <div className="text-2xl font-semibold tabular-nums">{effectiveBpm} BPM</div>
            <div className="text-xs text-muted-foreground">
              {tapBpm != null ? "From tap tempo" : "From analyzer"}
              {multiplier !== 1 ? ` · ${multiplier}×` : ""}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="space-y-2">
            <Label>Time signature</Label>
            <Select
              value={timeSignature}
              onValueChange={(value) => setTimeSignature(value as (typeof TIME_SIGNATURES)[number])}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_SIGNATURES.map((ts) => (
                  <SelectItem key={ts} value={ts}>
                    {ts}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tempo</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMultiplier((m) => Math.max(MIN_MULTIPLIER, m / 2))}
              >
                ½×
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMultiplier((m) => Math.min(MAX_MULTIPLIER, m * 2))}
              >
                2×
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tap tempo</Label>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={!isTrackPlaying}
              onClick={handleTap}
            >
              Tap
            </Button>
          </div>

          <div className="flex flex-col justify-end space-y-2">
            <div className="flex items-center gap-2">
              <Switch checked={noAccent} onCheckedChange={setNoAccent} id="no-accent" />
              <Label htmlFor="no-accent">No accent</Label>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t pt-4">
          {result ? (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => handleDownload("click", result.click_storage_path)}
                disabled={downloading !== null}
                className="flex-1"
              >
                {downloading === "click" ? "Preparing…" : "Download click only"}
              </Button>
              {result.merged_storage_path && (
                <Button
                  variant="secondary"
                  onClick={() => handleDownload("merged", result.merged_storage_path!)}
                  disabled={downloading !== null}
                  className="flex-1"
                >
                  {downloading === "merged" ? "Preparing…" : "Download merged with source"}
                </Button>
              )}
            </div>
          ) : (
            <JobStatusButton
              job={job}
              onStart={handleGenerate}
              submitting={submitting}
              idleLabel="Generate click track"
              processingLabel="Generating…"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
