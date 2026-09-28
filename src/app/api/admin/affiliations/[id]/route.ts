import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { name, is_allowed, avatar_url } = await request.json();

  const update: { name?: string; is_allowed?: boolean; avatar_url?: string | null } = {};
  if (name !== undefined) update.name = name;
  if (is_allowed !== undefined) update.is_allowed = is_allowed;
  if (avatar_url !== undefined) update.avatar_url = avatar_url?.trim() || null;

  const { error } = await auth.admin.from("affiliations").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { error } = await auth.admin.from("affiliations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
