import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/nav/site-header";
import { ProfileForm } from "@/components/profile/profile-form";
import type { Affiliation, Profile } from "@/types/database";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: affiliations }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("affiliations").select("*").eq("is_allowed", true).order("name"),
  ]);

  const resolvedProfile: Profile = (profile as Profile | null) ?? {
    id: user.id,
    display_name: null,
    avatar_url: null,
    role: null,
    affiliation_id: null,
    is_admin: false,
    created_at: user.created_at,
  };

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <SiteHeader
        email={user.email ?? ""}
        displayName={resolvedProfile.display_name}
        avatarUrl={resolvedProfile.avatar_url}
        isAdmin={resolvedProfile.is_admin}
      />
      <main className="mx-auto w-full max-w-lg flex-1 p-6">
        <ProfileForm
          email={user.email ?? ""}
          profile={resolvedProfile}
          affiliations={(affiliations as Affiliation[] | null) ?? []}
        />
      </main>
    </div>
  );
}
