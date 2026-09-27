import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const affiliationId = searchParams.get("affiliation_id");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Gate on affiliation even though Supabase's own code exchange already
      // succeeded — this is the actual enforcement point for "only allowed
      // affiliations can sign in": re-checked fresh from the DB every login,
      // not just trusted from whatever the login form submitted.
      if (!affiliationId) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=affiliation_required`);
      }

      const { data: affiliation } = await supabase
        .from("affiliations")
        .select("id")
        .eq("id", affiliationId)
        .eq("is_allowed", true)
        .maybeSingle();

      if (!affiliation) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=affiliation_not_allowed`);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").upsert({ id: user.id, affiliation_id: affiliationId });
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
