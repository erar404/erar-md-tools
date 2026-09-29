"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScissorsIcon, TimerIcon, Volume2Icon, type LucideIcon } from "lucide-react";
import { withViewTransitionNav } from "@/lib/view-transition";

const TOOLS: { href: string; label: string; description: string; icon: LucideIcon }[] = [
  {
    href: "trim",
    label: "Trim",
    description:
      "Cut the exact verse, bridge, or vamp you need out of the full track, then export just that piece.",
    icon: ScissorsIcon,
  },
  {
    href: "metronome",
    label: "Metronome",
    description:
      "Check the detected tempo, adjust the time signature or feel, and generate a click track to play against the recording.",
    icon: TimerIcon,
  },
  {
    href: "split",
    label: "Split",
    description:
      "Isolate vocals, drums, bass, or the rest of the mix so you can woodshed one part at a time.",
    icon: Volume2Icon,
  },
];

export function ToolChooser({ trackId }: { trackId: string }) {
  const router = useRouter();

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {TOOLS.map((tool) => {
        const href = `/edit/${trackId}/${tool.href}`;
        const Icon = tool.icon;
        return (
          <Link
            key={tool.href}
            href={href}
            onClick={(e) => {
              // Let modified clicks (open in new tab, etc.) behave normally;
              // only the plain-click path gets the animated panel swap.
              if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              withViewTransitionNav(() => router.push(href));
            }}
            className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-5 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
          >
            <div className="flex size-10 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
            <div className="space-y-1">
              <h2 className="font-heading text-base font-semibold text-foreground">{tool.label}</h2>
              <p className="text-sm text-muted-foreground">{tool.description}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
