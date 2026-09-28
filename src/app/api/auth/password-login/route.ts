import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Same message for "no such username" and "wrong password": telling a bad
// actor which one failed would let them enumerate valid usernames.
function invalidCredentials() {
  return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
}

export async function POST(request: Request) {
  const { username, password } = await request.json();
  if (!username || typeof username !== "string" || !password || typeof password !== "string") {
    return NextResponse.json({ error: "Enter your username and password." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, affiliation_id")
    .eq("username", username.trim().toLowerCase())
    .maybeSingle();
  if (!profile) return invalidCredentials();

  const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
  const email = authUser?.user?.email;
  if (!email) return invalidCredentials();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return invalidCredentials();

  // Gate on affiliation even though sign-in just succeeded: re-checked fresh
  // from the DB every login, same rule the magic-link callback enforces.
  const { data: allowed } = await supabase
    .from("affiliations")
    .select("id")
    .eq("id", profile.affiliation_id ?? "")
    .eq("is_allowed", true)
    .maybeSingle();

  if (!profile.affiliation_id || !allowed) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "Your affiliation isn't currently permitted to sign in." },
      { status: 403 }
    );
  }

  const { data: fullProfile } = await supabase
    .from("profiles")
    .select("must_change_password")
    .eq("id", data.user.id)
    .single();

  return NextResponse.json({
    ok: true,
    mustChangePassword: fullProfile?.must_change_password ?? false,
  });
}
