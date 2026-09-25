"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createSignedDownloadUrl } from "@/lib/storage-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FORMAT_OPTIONS,
  isEditableFormat,
  looksLikeYoutubeUrl,
  qualitiesForFormat,
  type DownloadFormat,
} from "@/lib/ytdlp-formats";
import type { Job } from "@/types/database";

interface DownloadResult {
  storage_path: string;
  title: string;
  filename: string;
  duration_seconds: number | null;
}

const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;

/** Best-effort — the edit page just shows "…" for key/tempo/time until
 * this succeeds, so a failure here isn't fatal to the landing flow. */
async function triggerAnalyze(trackId: string, storagePath: string) {
  try {
    await fetch("/api/jobs/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track_id: trackId, storage_path: storagePath }),
    });
  } catch {
    // ignore
  }
}

export function LandingFlow() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [format, setFormat] = useState<DownloadFormat>("mp3");
  const [quality, setQuality] = useState("best");

  const [job, setJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [continuing, setContinuing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live job status instead of polling — matches the app's architecture
  // (Realtime subscription on `jobs`, enabled in Phase 4's migration).
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

  function resetFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChosen(chosen: File) {
    if (chosen.size > MAX_UPLOAD_BYTES) {
      toast.error(`File is too large — max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.`);
      return;
    }
    setFile(chosen);
    setYoutubeUrl("");
    setShowFormatPicker(false);
    setJob(null);
  }

  function handleUrlChange(value: string) {
    setYoutubeUrl(value);
    setShowFormatPicker(false);
    setJob(null);
    if (value) resetFile();
  }

  async function handleProcess() {
    if (file) {
      await handleUpload(file);
      return;
    }
    if (!looksLikeYoutubeUrl(youtubeUrl)) {
      toast.error("Paste a YouTube URL, or choose a file to upload.");
      return;
    }
    setShowFormatPicker(true);
  }

  async function handleDownload() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/jobs/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtube_url: youtubeUrl, format, quality }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Download failed to start");
      setJob(data.job as Job);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed to start");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpload(chosenFile: File) {
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const key = `${user.id}/${crypto.randomUUID()}/${chosenFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("raw-uploads")
        .upload(key, chosenFile);
      if (uploadError) throw uploadError;

      const storagePath = `raw-uploads/${key}`;
      const title = chosenFile.name.replace(/\.[^/.]+$/, "");

      const { data: track, error: insertError } = await supabase
        .from("tracks")
        .insert({ user_id: user.id, title, source_type: "upload", storage_path: storagePath })
        .select()
        .single();
      if (insertError || !track) throw insertError ?? new Error("Could not create track");

      void triggerAnalyze(track.id, storagePath);
      router.push(`/edit/${track.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setSubmitting(false);
    }
  }

  async function handleContinueToEdit() {
    if (!job?.result) return;
    setContinuing(true);
    try {
      const result = job.result as unknown as DownloadResult;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { data: track, error: insertError } = await supabase
        .from("tracks")
        .insert({
          user_id: user.id,
          title: result.title,
          source_type: "youtube",
          source_url: youtubeUrl,
          storage_path: result.storage_path,
          duration_seconds: result.duration_seconds,
        })
        .select()
        .single();
      if (insertError || !track) throw insertError ?? new Error("Could not create track");

      void triggerAnalyze(track.id, result.storage_path);
      router.push(`/edit/${track.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not continue to edit");
      setContinuing(false);
    }
  }

  async function handleDownloadFile() {
    if (!job?.result) return;
    const result = job.result as unknown as DownloadResult;
    try {
      window.location.href = await createSignedDownloadUrl(supabase, result.storage_path);
    } catch {
      toast.error("Could not create a download link");
    }
  }

  function reset() {
    setYoutubeUrl("");
    resetFile();
    setShowFormatPicker(false);
    setJob(null);
  }

  if (job) {
    return (
      <div className="space-y-4">
        {job.status !== "done" && job.status !== "error" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            {job.status === "pending" ? "Queued…" : "Downloading…"}
          </div>
        )}
        {job.status === "error" && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">
              {job.error_message ?? "Download failed."}
            </p>
            <Button variant="outline" onClick={reset} className="w-full">
              Try again
            </Button>
          </div>
        )}
        {job.status === "done" && (
          <div className="space-y-3">
            <p className="text-sm">Download complete.</p>
            {isEditableFormat(format) ? (
              <Button onClick={handleContinueToEdit} disabled={continuing} className="w-full">
                {continuing ? "Opening…" : "Continue to Edit"}
              </Button>
            ) : (
              <Button onClick={handleDownloadFile} className="w-full">
                Download file
              </Button>
            )}
            <Button variant="ghost" onClick={reset} className="w-full">
              Start over
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="youtube-url">YouTube URL</Label>
        <Input
          id="youtube-url"
          placeholder="https://youtube.com/watch?v=…"
          value={youtubeUrl}
          onChange={(e) => handleUrlChange(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) handleFileChosen(dropped);
        }}
        className={`flex w-full flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-sm transition-colors ${
          dragActive ? "border-primary bg-primary/5" : "border-border"
        }`}
      >
        <UploadIcon className="size-5 text-muted-foreground" />
        {file ? (
          <span className="font-medium">{file.name}</span>
        ) : (
          <span className="text-muted-foreground">
            Drop an audio file, or click to choose one
          </span>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const chosen = e.target.files?.[0];
          if (chosen) handleFileChosen(chosen);
        }}
      />

      {showFormatPicker && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Format</Label>
              <Select
                value={format}
                onValueChange={(value) => {
                  setFormat(value as DownloadFormat);
                  setQuality("best");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quality</Label>
              <Select value={quality} onValueChange={(value) => setQuality(value as string)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {qualitiesForFormat(format).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleDownload} disabled={submitting} className="w-full">
            {submitting ? "Starting…" : "Download"}
          </Button>
        </div>
      )}

      {!showFormatPicker && (
        <Button onClick={handleProcess} disabled={submitting} className="w-full">
          {submitting ? "Uploading…" : "Process"}
        </Button>
      )}
    </div>
  );
}
