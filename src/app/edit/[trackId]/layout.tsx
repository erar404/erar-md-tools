import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AnalyzerHeader } from "@/components/edit/analyzer-header";
import { TrackAudioProvider } from "@/components/edit/track-audio-provider";
import { EditTabs } from "@/components/edit/edit-tabs";
import { Logo } from "@/components/branding/logo";
import { UserMenu } from "@/components/nav/user-menu";
import type { Profile, Track } from "@/types/database";

export default async function EditLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ trackId: string }>;
}) {
  const { trackId } = await params;
  const supabase = await createClient();
  const [{ data }, { data: userData }] = await Promise.all([
    supabase.from("tracks").select("*").eq("id", trackId).single(),
    supabase.auth.getUser(),
  ]);

  if (!data) notFound();
  const track = data as Track;

  let userProfile: Profile | null = null;
  if (userData.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userData.user.id)
      .single();
    userProfile = profile as Profile | null;
  }

  return (
    <TrackAudioProvider track={track}>
      <div className="flex min-h-full flex-1 flex-col bg-background">
        <header className="border-b border-border/60 bg-card/40 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Logo />
              <span className="hidden text-border/60 sm:inline">/</span>
              <h1 className="truncate font-heading text-base font-semibold text-foreground">
                {track.title}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <AnalyzerHeader initialTrack={track} />
              {userData.user && (
                <UserMenu
                  email={userData.user.email ?? ""}
                  displayName={userProfile?.display_name ?? null}
                  avatarUrl={userProfile?.avatar_url}
                />
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <EditTabs trackId={trackId} />
            <p className="text-xs text-muted-foreground">
              Work through the tabs left to right: trim your clip, build a click track, then split
              the stems.
            </p>
          </div>
        </header>
        <main className="flex-1 bg-background p-6">{children}</main>
      </div>
    </TrackAudioProvider>
  );
}
