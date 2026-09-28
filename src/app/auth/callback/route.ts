import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const affiliationId = searchParams.get("affiliation_id");
  const userTypeId = searchParams.get("user_type_id");
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
        // user_type is descriptive only, not a sign-in gate — validated
        // loosely (it must exist) but never blocks login the way affiliation does.
        let validUserTypeId: string | null = null;
        if (userTypeId) {
          const { data: userType } = await supabase
            .from("user_types")
            .select("id")
            .eq("id", userTypeId)
            .maybeSingle();
          validUserTypeId = userType?.id ?? null;
        }

        await supabase.from("profiles").upsert({
          id: user.id,
          affiliation_id: affiliationId,
          ...(validUserTypeId ? { user_type_id: validUserTypeId } : {}),
        });
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
