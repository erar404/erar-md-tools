import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/nav/site-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminUsersPanel } from "@/components/admin/admin-users-panel";
import { AdminAffiliationsPanel } from "@/components/admin/admin-affiliations-panel";
import { AdminAffiliationRequestsPanel } from "@/components/admin/admin-affiliation-requests-panel";
import type { Profile } from "@/types/database";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const resolvedProfile = profile as Profile | null;
  if (!resolvedProfile?.is_admin) redirect("/");

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <SiteHeader
        email={user.email ?? ""}
        displayName={resolvedProfile.display_name}
        avatarUrl={resolvedProfile.avatar_url}
      />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-6">
        <div>
          <h1 className="font-heading text-xl font-semibold">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Manage team members, affiliations, and incoming affiliation requests.
          </p>
        </div>
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="affiliations">Affiliations</TabsTrigger>
            <TabsTrigger value="requests">Affiliation requests</TabsTrigger>
          </TabsList>
          <TabsContent value="users">
            <AdminUsersPanel />
          </TabsContent>
          <TabsContent value="affiliations">
            <AdminAffiliationsPanel />
          </TabsContent>
          <TabsContent value="requests">
            <AdminAffiliationRequestsPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
