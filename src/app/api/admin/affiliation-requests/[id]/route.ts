import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { action } = await request.json();
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const { data: req, error: reqError } = await auth.admin
    .from("affiliation_requests")
    .select("*")
    .eq("id", id)
    .single();
  if (reqError || !req) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (action === "approve") {
    // Reuse an existing affiliation (case-insensitive) rather than creating
    // a near-duplicate if an admin already added one with the same name.
    const { data: existing } = await auth.admin
      .from("affiliations")
      .select("id")
      .ilike("name", req.name)
      .maybeSingle();

    if (existing) {
      await auth.admin.from("affiliations").update({ is_allowed: true }).eq("id", existing.id);
    } else {
      const { error: insertError } = await auth.admin
        .from("affiliations")
        .insert({ name: req.name, is_allowed: true });
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 });
      }
    }
  }

  const { error } = await auth.admin
    .from("affiliation_requests")
    .update({ status: action === "approve" ? "approved" : "rejected" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
