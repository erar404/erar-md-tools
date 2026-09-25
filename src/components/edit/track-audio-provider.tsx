"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { Track } from "@/types/database";

interface TrackAudioContextValue {
  track: Track;
  audioUrl: string | null;
  audioRef: RefObject<HTMLAudioElement | null>;
}

const TrackAudioContext = createContext<TrackAudioContextValue | null>(null);

export function useTrackAudio() {
  const ctx = useContext(TrackAudioContext);
  if (!ctx) throw new Error("useTrackAudio must be used within TrackAudioProvider");
  return ctx;
}

/**
 * One `<audio>` element for the whole edit layout, so playback position and
 * play/pause state survive switching between the Trim/Metronome/Split tabs
 * instead of resetting each time a tab's page component remounts. Each tab
 * (Phase 6+) points its own wavesurfer.js instance at this element via
 * wavesurfer's `media` option rather than creating a separate audio source.
 */
export function TrackAudioProvider({
  track,
  children,
}: {
  track: Track;
  children: React.ReactNode;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function resolveUrl() {
      const supabase = createClient();
      const [bucket, ...rest] = track.storage_path.split("/");
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(rest.join("/"), 3600);
      if (!cancelled && !error && data) setAudioUrl(data.signedUrl);
    }
    void resolveUrl();
    return () => {
      cancelled = true;
    };
  }, [track.storage_path]);

  return (
    <TrackAudioContext.Provider value={{ track, audioUrl, audioRef }}>
      <audio ref={audioRef} src={audioUrl ?? undefined} preload="metadata" className="hidden" />
      {children}
    </TrackAudioContext.Provider>
  );
}
