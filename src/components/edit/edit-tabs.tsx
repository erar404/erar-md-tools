"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScissorsIcon, TimerIcon, Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "trim", label: "Trim", hint: "Cut a clip", icon: ScissorsIcon },
  { href: "metronome", label: "Metronome", hint: "Build a click track", icon: TimerIcon },
  { href: "split", label: "Split", hint: "Separate instruments", icon: Volume2Icon },
] as const;

export function EditTabs({ trackId }: { trackId: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const href = `/edit/${trackId}/${tab.href}`;
        const active = pathname?.startsWith(href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
              active
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            <span className="font-medium">{tab.label}</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">— {tab.hint}</span>
          </Link>
        );
      })}
    </nav>
  );
}
