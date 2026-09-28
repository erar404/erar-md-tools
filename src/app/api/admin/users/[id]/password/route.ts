import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

// Readable alphabet (no 0/O/1/l/I): an admin reads this aloud or pastes it
// into a message once, then the user is forced to replace it immediately.
const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generateTempPassword() {
  return Array.from(
    { length: 14 },
    () => TEMP_PASSWORD_ALPHABET[Math.floor(Math.random() * TEMP_PASSWORD_ALPHABET.length)]
  ).join("");
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const password = generateTempPassword();

  const { error: authError } = await auth.admin.auth.admin.updateUserById(id, {
    password,
    email_confirm: true,
  });
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

  const { error: profileError } = await auth.admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", id);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });

  return NextResponse.json({ password });
}
