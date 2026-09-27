import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/nav/site-header";
import { DownloadJobRow } from "@/components/library/download-job-row";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Job, Profile, Track } from "@/types/database";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: tracks }, { data: downloadJobs }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("tracks").select("*").order("created_at", { ascending: false }),
    supabase
      .from("jobs")
      .select("*")
      .eq("type", "download")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const resolvedProfile = profile as Profile | null;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <SiteHeader
        email={user.email ?? ""}
        displayName={resolvedProfile?.display_name ?? null}
        avatarUrl={resolvedProfile?.avatar_url}
        isAdmin={resolvedProfile?.is_admin}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 p-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Your sessions</CardTitle>
            <CardDescription>
              Tracks you&rsquo;ve imported and edited. Pick one up where you left off.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!tracks || tracks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing here yet — process a YouTube link or upload a file from the home page to
                get started.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {(tracks as Track[]).map((track) => (
                  <li key={track.id}>
                    <Link
                      href={`/edit/${track.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 py-3 hover:text-primary"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{track.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {track.source_type === "youtube" ? "YouTube" : "Uploaded"} ·{" "}
                          {formatDate(track.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {track.analyzed_key && (
                          <Badge variant="secondary" className="font-mono">
                            {track.analyzed_key}
                          </Badge>
                        )}
                        {track.analyzed_tempo && (
                          <Badge variant="secondary" className="font-mono">
                            {Math.round(track.analyzed_tempo)} BPM
                          </Badge>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Recent downloads</CardTitle>
            <CardDescription>
              Your last {"" + (downloadJobs?.length ?? 0)} YouTube downloads, including ones that
              weren&apos;t continued into an editing session.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!downloadJobs || downloadJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No downloads yet.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {(downloadJobs as Job[]).map((job) => (
                  <DownloadJobRow key={job.id} job={job} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
