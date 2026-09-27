import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return { supabase, user };
}

/** Confirms the caller is signed in AND flagged `is_admin` on their own
 * profile row (readable under the normal own-row RLS policy — no special
 * admin policy needed for this self-check). Returns an admin (service-role)
 * client for the route to use for any cross-user reads/writes, since admin
 * operations intentionally bypass the regular per-user RLS policies. */
export async function requireAdmin() {
  const auth = await requireUser();
  if (!auth) return null;

  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", auth.user.id)
    .single();

  if (!profile?.is_admin) return null;
  return { ...auth, admin: createAdminClient() };
}
