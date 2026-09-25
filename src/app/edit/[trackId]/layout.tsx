import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AnalyzerHeader } from "@/components/edit/analyzer-header";
import { TrackAudioProvider } from "@/components/edit/track-audio-provider";
import type { Track } from "@/types/database";

const TABS = [
  { href: "trim", label: "Trim" },
  { href: "metronome", label: "Metronome" },
  { href: "split", label: "Split" },
] as const;

export default async function EditLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ trackId: string }>;
}) {
  const { trackId } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("tracks")
    .select("*")
    .eq("id", trackId)
    .single();

  if (!data) notFound();
  const track = data as Track;

  return (
    <TrackAudioProvider track={track}>
      <div className="flex min-h-full flex-1 flex-col">
        <header className="border-b px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="truncate text-lg font-semibold">{track.title}</h1>
            <AnalyzerHeader initialTrack={track} />
          </div>
          <nav className="mt-4 flex gap-4 text-sm">
            {TABS.map((tab) => (
              <Link
                key={tab.href}
                href={`/edit/${trackId}/${tab.href}`}
                className="text-muted-foreground hover:text-foreground"
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </TrackAudioProvider>
  );
}
