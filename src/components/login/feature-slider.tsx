"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Gauge, Scissors, SplitSquareHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: Download,
    title: "Pull it from YouTube",
    description:
      "Paste a link and grab the reference track or performance video without leaving the browser.",
  },
  {
    icon: Scissors,
    title: "Trim to the clip you need",
    description: "Cut a verse, a bridge, or a sixteen-bar vamp, then export just the part you're rehearsing.",
  },
  {
    icon: Gauge,
    title: "Check the tempo",
    description: "Run a click track against the recording and confirm the BPM before you print charts.",
  },
  {
    icon: SplitSquareHorizontal,
    title: "Split the stems",
    description: "Isolate vocals, drums, bass, or a solo part to woodshed one line at a time.",
  },
] as const;

const AUTO_ADVANCE_MS = 5500;

export function FeatureSlider() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = FEATURES.length;

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [paused, count]);

  const feature = FEATURES[index];
  const Icon = feature.icon;

  function go(delta: number) {
    setPaused(true);
    setIndex((i) => (i + delta + count) % count);
  }

  return (
    <div
      className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="MD Tools features"
    >
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          What&rsquo;s inside
        </span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
        </span>
      </div>

      <div className="flex items-start gap-4 px-5 py-6" aria-live="polite">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 space-y-1 pt-0.5">
          <h3 className="font-heading text-base font-semibold text-foreground">{feature.title}</h3>
          <p className="text-sm text-muted-foreground">{feature.description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous feature"
          className="flex size-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div className="flex items-center gap-1.5">
          {FEATURES.map((f, i) => (
            <button
              key={f.title}
              type="button"
              onClick={() => {
                setPaused(true);
                setIndex(i);
              }}
              aria-label={`Show feature ${i + 1}: ${f.title}`}
              aria-current={i === index}
              className={cn(
                "size-1.5 rounded-full transition-colors",
                i === index ? "bg-primary" : "bg-border"
              )}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next feature"
          className="flex size-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
