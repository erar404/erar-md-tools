import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [{ data: profiles, error: profilesError }, { data: usersPage, error: usersError }] =
    await Promise.all([
      auth.admin.from("profiles").select("*").order("created_at"),
      auth.admin.auth.admin.listUsers({ perPage: 500 }),
    ]);

  if (profilesError || usersError) {
    return NextResponse.json(
      { error: profilesError?.message ?? usersError?.message ?? "Failed to load users" },
      { status: 500 }
    );
  }

  const emailById = new Map(usersPage.users.map((u) => [u.id, u.email ?? ""]));
  const users = (profiles ?? []).map((profile) => ({
    ...profile,
    email: emailById.get(profile.id) ?? "",
  }));

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email } = await request.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const { data, error } = await auth.admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ user: data.user });
}
