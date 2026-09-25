"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import type { Track } from "@/types/database";

// Server-rendered `initialTrack` covers the first paint; the Realtime
// subscription below picks up the processor's UPDATE once /api/jobs/analyze
// finishes, so the badges flip from "…" to real values without a reload.
export function AnalyzerHeader({ initialTrack }: { initialTrack: Track }) {
  const [supabase] = useState(() => createClient());
  const [track, setTrack] = useState(initialTrack);

  useEffect(() => {
    if (track.analyzed_key && track.analyzed_tempo && track.analyzed_time_signature) {
      return;
    }

    const channel = supabase
      .channel(`track-${track.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tracks", filter: `id=eq.${track.id}` },
        (payload) => setTrack(payload.new as Track)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.id, supabase]);

  return (
    <div className="flex items-center gap-2 text-sm">
      <Badge variant="secondary">Key: {track.analyzed_key ?? "…"}</Badge>
      <Badge variant="secondary">
        Tempo: {track.analyzed_tempo ? `${Math.round(track.analyzed_tempo)} BPM` : "…"}
      </Badge>
      <Badge variant="secondary">Time: {track.analyzed_time_signature ?? "…"}</Badge>
    </div>
  );
}
