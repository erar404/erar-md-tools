"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Track } from "@/types/database";

function Readout({
  label,
  value,
  dotClassName,
}: {
  label: string;
  value: string;
  dotClassName: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-3 py-1.5">
      <span className={cn("size-1.5 rounded-full", dotClassName)} />
      <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      <span className="font-mono text-sm tabular-nums text-foreground">{value}</span>
    </div>
  );
}

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
    <div className="flex flex-wrap items-center gap-2">
      <Readout label="Key" value={track.analyzed_key ?? "…"} dotClassName="bg-signal-cyan" />
      <Readout
        label="Tempo"
        value={track.analyzed_tempo ? `${Math.round(track.analyzed_tempo)} BPM` : "…"}
        dotClassName="bg-primary"
      />
      <Readout
        label="Time"
        value={track.analyzed_time_signature ?? "…"}
        dotClassName="bg-signal-teal"
      />
    </div>
  );
}
