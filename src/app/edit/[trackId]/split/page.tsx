"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2Icon, PauseIcon, PlayIcon } from "lucide-react";
import { toast } from "sonner";
import WaveSurfer from "wavesurfer.js";
import { useTrackAudio } from "@/components/edit/track-audio-provider";
import { JobStatusButton } from "@/components/edit/job-status-button";
import { createClient } from "@/lib/supabase/client";
import { createSignedDownloadUrl } from "@/lib/storage-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Job } from "@/types/database";

interface SplitResult {
  stems: Record<string, string>;
}

interface MixdownResult {
  storage_path: string;
}

interface StemInfo {
  name: string;
  storagePath: string;
  url: string;
}

const STEM_LABELS: Record<string, string> = {
  vocals: "Vocals",
  drums: "Drums",
  bass: "Bass",
  other: "Other / Instrumental",
  piano: "Piano",
};

export default function SplitPage() {
  const { track } = useTrackAudio();
  const [supabase] = useState(() => createClient());

  const [stemCount, setStemCount] = useState<"2" | "4">("4");
  const [splitJob, setSplitJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [stems, setStems] = useState<StemInfo[] | null>(null);
  const [loadingStems, setLoadingStems] = useState(false);

  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [muted, setMuted] = useState<Record<string, boolean>>({});
  const [soloed, setSoloed] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [mixdownJob, setMixdownJob] = useState<Job | null>(null);
  const [mixingDown, setMixingDown] = useState(false);
  const [downloadingStem, setDownloadingStem] = useState<string | null>(null);
  const [downloadingMixdown, setDownloadingMixdown] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const gainNodesRef = useRef<Map<string, GainNode>>(new Map());
  const sourceNodesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
  const wavesurfersRef = useRef<Map<string, WaveSurfer>>(new Map());
  const playbackStartCtxTimeRef = useRef(0);
  const playbackStartOffsetRef = useRef(0);
  const manualStopRef = useRef(false);

  const effectiveGain = useCallback(
    (name: string) => {
      if (soloed) return soloed === name ? (volumes[name] ?? 1) : 0;
      return muted[name] ? 0 : (volumes[name] ?? 1);
    },
    [soloed, muted, volumes]
  );

  // Live status for the split job.
  useEffect(() => {
    if (!splitJob || splitJob.status === "done" || splitJob.status === "error") return;
    const channel = supabase
      .channel(`job-${splitJob.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${splitJob.id}` },
        (payload) => setSplitJob(payload.new as Job)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [splitJob, supabase]);

  // Live status for the mixdown job.
  useEffect(() => {
    if (!mixdownJob || mixdownJob.status === "done" || mixdownJob.status === "error") return;
    const channel = supabase
      .channel(`job-${mixdownJob.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${mixdownJob.id}` },
        (payload) => setMixdownJob(payload.new as Job)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [mixdownJob, supabase]);

  // Once the split completes, resolve signed URLs and build the shared
  // Web Audio playback graph (decoded sequentially — this machine is
  // memory-constrained, and decodeAudioData is CPU-heavy).
  useEffect(() => {
    if (splitJob?.status !== "done") return;
    const result = splitJob.result as unknown as SplitResult;
    let cancelled = false;

    async function setup() {
      setLoadingStems(true);
      try {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;

        const resolved: StemInfo[] = [];
        const initialVolumes: Record<string, number> = {};
        const initialMuted: Record<string, boolean> = {};

        for (const [name, storagePath] of Object.entries(result.stems)) {
          const url = await createSignedDownloadUrl(supabase, storagePath);
          if (cancelled) return;

          const gainNode = ctx.createGain();
          gainNode.connect(ctx.destination);
          gainNodesRef.current.set(name, gainNode);

          const res = await fetch(url);
          const arrayBuffer = await res.arrayBuffer();
          const buffer = await ctx.decodeAudioData(arrayBuffer);
          if (cancelled) return;
          buffersRef.current.set(name, buffer);

          resolved.push({ name, storagePath, url });
          initialVolumes[name] = 1;
          initialMuted[name] = false;
        }

        if (cancelled) return;
        setVolumes(initialVolumes);
        setMuted(initialMuted);
        setStems(resolved);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not load stems");
      } finally {
        if (!cancelled) setLoadingStems(false);
      }
    }

    void setup();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitJob?.status]);

  // Mute/solo/volume changes only touch gain, never pause/restart sources,
  // so all stems stay sample-accurately in sync.
  useEffect(() => {
    if (!stems) return;
    for (const stem of stems) {
      const gainNode = gainNodesRef.current.get(stem.name);
      if (gainNode) gainNode.gain.value = effectiveGain(stem.name);
    }
  }, [stems, effectiveGain]);

  // Shared requestAnimationFrame playhead drives every stem's (non-interactive) waveform.
  useEffect(() => {
    if (!isPlaying) return;
    let raf: number;
    function tick() {
      const ctx = audioCtxRef.current;
      if (ctx) {
        const t = playbackStartOffsetRef.current + (ctx.currentTime - playbackStartCtxTimeRef.current);
        wavesurfersRef.current.forEach((ws) => {
          try {
            ws.setTime(t);
          } catch {
            // instance may be mid-teardown
          }
        });
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  useEffect(() => {
    // sourceNodesRef/audioCtxRef hold mutable instance state (populated
    // async, well after mount), not a DOM node — cleanup must read their
    // value at unmount time, not a value captured at mount time.
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      sourceNodesRef.current.forEach((src) => {
        try {
          src.stop();
        } catch {
          // already stopped
        }
      });
      void audioCtxRef.current?.close();
    };
  }, []);

  const registerWavesurfer = useCallback((name: string, ws: WaveSurfer | null) => {
    if (ws) wavesurfersRef.current.set(name, ws);
    else wavesurfersRef.current.delete(name);
  }, []);

  function handlePlayPause() {
    const ctx = audioCtxRef.current;
    if (!ctx || !stems) return;

    if (isPlaying) {
      const elapsed =
        playbackStartOffsetRef.current + (ctx.currentTime - playbackStartCtxTimeRef.current);
      manualStopRef.current = true;
      sourceNodesRef.current.forEach((src) => {
        try {
          src.stop();
        } catch {
          // already stopped
        }
      });
      sourceNodesRef.current.clear();
      playbackStartOffsetRef.current = elapsed;
      setIsPlaying(false);
      return;
    }

    const startAt = ctx.currentTime + 0.05;
    let firstSource: AudioBufferSourceNode | null = null;
    for (const stem of stems) {
      const buffer = buffersRef.current.get(stem.name);
      const gainNode = gainNodesRef.current.get(stem.name);
      if (!buffer || !gainNode) continue;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(gainNode);
      src.start(startAt, playbackStartOffsetRef.current);
      sourceNodesRef.current.set(stem.name, src);
      if (!firstSource) firstSource = src;
    }
    if (firstSource) {
      firstSource.onended = () => {
        if (manualStopRef.current) {
          manualStopRef.current = false;
          return;
        }
        playbackStartOffsetRef.current = 0;
        sourceNodesRef.current.clear();
        setIsPlaying(false);
      };
    }
    playbackStartCtxTimeRef.current = startAt;
    setIsPlaying(true);
  }

  async function handleSplit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/jobs/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track_id: track.id,
          storage_path: track.storage_path,
          stems: Number(stemCount),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Split failed to start");
      setSplitJob(data.job as Job);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Split failed to start");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownloadStem(stem: StemInfo) {
    setDownloadingStem(stem.name);
    try {
      window.location.assign(await createSignedDownloadUrl(supabase, stem.storagePath));
    } catch {
      toast.error("Could not create a download link");
    } finally {
      setDownloadingStem(null);
    }
  }

  async function handleGenerateMixdown() {
    if (!stems) return;
    setMixingDown(true);
    try {
      const payloadStems = stems.map((stem) => ({
        storage_path: stem.storagePath,
        gain: effectiveGain(stem.name),
      }));
      const res = await fetch("/api/jobs/mixdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track_id: track.id, stems: payloadStems }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Mixdown failed to start");
      setMixdownJob(data.job as Job);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mixdown failed to start");
    } finally {
      setMixingDown(false);
    }
  }

  const mixdownResult =
    mixdownJob?.status === "done" ? (mixdownJob.result as unknown as MixdownResult) : null;

  async function handleDownloadMixdown() {
    if (!mixdownResult) return;
    setDownloadingMixdown(true);
    try {
      window.location.assign(await createSignedDownloadUrl(supabase, mixdownResult.storage_path));
    } catch {
      toast.error("Could not create a download link");
    } finally {
      setDownloadingMixdown(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Track Splitter</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!stems && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Label>Stems</Label>
              <Select value={stemCount} onValueChange={(value) => setStemCount(value as "2" | "4")}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 — vocals / instrumental</SelectItem>
                  <SelectItem value="4">4 — vocals / drums / bass / other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <JobStatusButton
              job={splitJob}
              onStart={handleSplit}
              submitting={submitting}
              idleLabel="Split"
              processingLabel="Splitting… this can take a few minutes"
            />
          </div>
        )}

        {loadingStems && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading stems…
          </div>
        )}

        {stems && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="icon" onClick={handlePlayPause}>
                {isPlaying ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
              </Button>
              <span className="text-sm text-muted-foreground">
                Synchronized playback across all stems
              </span>
            </div>

            <div className="space-y-3">
              {stems.map((stem) => (
                <StemTrack
                  key={stem.name}
                  name={stem.name}
                  url={stem.url}
                  volume={volumes[stem.name] ?? 1}
                  muted={muted[stem.name] ?? false}
                  soloed={soloed === stem.name}
                  onVolumeChange={(v) =>
                    setVolumes((prev) => ({ ...prev, [stem.name]: v }))
                  }
                  onToggleMute={() =>
                    setMuted((prev) => ({ ...prev, [stem.name]: !prev[stem.name] }))
                  }
                  onToggleSolo={() =>
                    setSoloed((prev) => (prev === stem.name ? null : stem.name))
                  }
                  onDownload={() => handleDownloadStem(stem)}
                  downloading={downloadingStem === stem.name}
                  registerWavesurfer={registerWavesurfer}
                />
              ))}
            </div>

            <div className="space-y-2 border-t pt-4">
              {mixdownResult ? (
                <Button onClick={handleDownloadMixdown} disabled={downloadingMixdown} className="w-full">
                  {downloadingMixdown ? "Preparing…" : "Download mixdown"}
                </Button>
              ) : (
                <JobStatusButton
                  job={mixdownJob}
                  onStart={handleGenerateMixdown}
                  submitting={mixingDown}
                  idleLabel="Generate mixdown at current levels"
                  processingLabel="Mixing…"
                />
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StemTrack({
  name,
  url,
  volume,
  muted,
  soloed,
  onVolumeChange,
  onToggleMute,
  onToggleSolo,
  onDownload,
  downloading,
  registerWavesurfer,
}: {
  name: string;
  url: string;
  volume: number;
  muted: boolean;
  soloed: boolean;
  onVolumeChange: (value: number) => void;
  onToggleMute: () => void;
  onToggleSolo: () => void;
  onDownload: () => void;
  downloading: boolean;
  registerWavesurfer: (name: string, ws: WaveSurfer | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      url,
      height: 56,
      waveColor: "#a1a1aa",
      progressColor: "#ef4444",
      interact: false,
      hideScrollbar: true,
    });
    registerWavesurfer(name, ws);
    return () => {
      registerWavesurfer(name, null);
      ws.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{STEM_LABELS[name] ?? name}</span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={muted ? "secondary" : "outline"}
            onClick={onToggleMute}
          >
            Mute
          </Button>
          <Button
            type="button"
            size="sm"
            variant={soloed ? "default" : "outline"}
            onClick={onToggleSolo}
          >
            Solo
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDownload} disabled={downloading}>
            {downloading ? "…" : "Download"}
          </Button>
        </div>
      </div>
      <div ref={containerRef} className="rounded bg-muted/30" />
      <div className="flex items-center gap-2">
        <Label className="w-14 shrink-0 text-xs text-muted-foreground">Volume</Label>
        <Slider
          value={volume}
          min={0}
          max={1.5}
          step={0.01}
          onValueChange={(value) => onVolumeChange(Array.isArray(value) ? value[0] : value)}
        />
      </div>
    </div>
  );
}
