import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LandingFlow } from "@/components/landing/landing-flow";
import { SiteHeader } from "@/components/nav/site-header";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    profile = data as Profile | null;
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      {user && (
        <SiteHeader
          email={user.email ?? ""}
          displayName={profile?.display_name ?? null}
          avatarUrl={profile?.avatar_url}
          isAdmin={profile?.is_admin}
        />
      )}
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <Image src="/brand-background.png" alt="" width={140} height={140} priority />
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle className="font-heading">MD Tools</CardTitle>
            <CardDescription>
              Paste a YouTube link or drop an audio file below, then press Process.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LandingFlow />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
