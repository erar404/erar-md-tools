"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { Affiliation } from "@/types/database";

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  affiliation_required: "Pick your affiliation before requesting a sign-in link.",
  affiliation_not_allowed:
    "That affiliation isn't currently permitted to sign in. Contact your admin if this seems wrong.",
};

export default function LoginPage() {
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState("");
  const [affiliationId, setAffiliationId] = useState("");
  const [affiliations, setAffiliations] = useState<Affiliation[] | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase
      .from("affiliations")
      .select("*")
      .eq("is_allowed", true)
      .order("name")
      .then(({ data }) => setAffiliations((data as Affiliation[] | null) ?? []));

    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get("error");
    if (errorCode) {
      toast.error(CALLBACK_ERROR_MESSAGES[errorCode] ?? "Sign-in failed. Please try again.");
    }
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!affiliationId) {
      toast.error("Select your affiliation first.");
      return;
    }
    setSending(true);

    const redirectUrl = new URL(`${process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL}/auth/callback`);
    redirectUrl.searchParams.set("affiliation_id", affiliationId);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectUrl.toString() },
    });

    setSending(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setSent(true);
  }

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 p-6">
      <Image src="/erar-full.png" alt="" width={166} height={180} priority />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>MD Tools</CardTitle>
          {sent ? (
            <CardDescription className="flex items-center gap-2 pt-1">
              <Image src="/happy-logo.png" alt="" width={28} height={28} className="rounded-full" />
              Check your email for a sign-in link.
            </CardDescription>
          ) : (
            <CardDescription>Sign in with your team email to continue.</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {!sent && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="affiliation">Affiliation</Label>
                <Select value={affiliationId} onValueChange={(value) => setAffiliationId(value ?? "")}>
                  <SelectTrigger id="affiliation" className="w-full">
                    <SelectValue
                      placeholder={
                        affiliations === null
                          ? "Loading…"
                          : affiliations.length === 0
                            ? "No affiliations available"
                            : "Select your affiliation"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {affiliations?.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={sending || !affiliations?.length}
              >
                {sending ? "Sending link…" : "Send sign-in link"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
