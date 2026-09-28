"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/branding/logo";
import { FeatureSlider } from "@/components/login/feature-slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import type { Affiliation, UserType } from "@/types/database";

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
  const [userTypeId, setUserTypeId] = useState("");
  const [userTypes, setUserTypes] = useState<UserType[] | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const [mode, setMode] = useState<"link" | "password">("link");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  const affiliationPlaceholder =
    affiliations === null
      ? "Loading…"
      : affiliations.length === 0
        ? "No affiliations available"
        : "Select your affiliation";
  const userTypePlaceholder = userTypes === null ? "Loading…" : "Select a type";

  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [requestSending, setRequestSending] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    supabase
      .from("affiliations")
      .select("*")
      .eq("is_allowed", true)
      .order("name")
      .then(({ data }) => setAffiliations((data as Affiliation[] | null) ?? []));

    supabase
      .from("user_types")
      .select("*")
      .order("name")
      .then(({ data }) => setUserTypes((data as UserType[] | null) ?? []));

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
    if (userTypeId) redirectUrl.searchParams.set("user_type_id", userTypeId);

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

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSigningIn(true);

    try {
      const res = await fetch("/api/auth/password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sign-in failed. Please try again.");

      // Full navigation, not the router: the server needs to see the auth
      // cookies this route just set, which a client-side route change won't refetch.
      const next = new URLSearchParams(window.location.search).get("next") ?? "/";
      window.location.href = data.mustChangePassword ? "/profile?must_change_password=1" : next;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
      setSigningIn(false);
    }
  }

  async function handleRequestAffiliation(e: React.FormEvent) {
    e.preventDefault();
    setRequestSending(true);
    try {
      const { error } = await supabase.from("affiliation_requests").insert({
        name: requestName.trim(),
        requested_by_email: requestEmail.trim(),
        note: requestNote.trim() || null,
      });
      if (error) throw error;
      setRequestSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit request");
    } finally {
      setRequestSending(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8 lg:px-10 lg:py-10">
        <div className="flex items-center justify-between">
          <Logo iconSize={30} />
          <Badge variant="outline">Invite-only access</Badge>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-12 py-10 lg:grid lg:grid-cols-[1.4fr_1fr] lg:content-center lg:items-center lg:gap-16 lg:py-16">
          <div className="flex flex-col gap-8 lg:self-stretch lg:border-r lg:border-border/60 lg:pr-16">
            <div className="flex flex-col-reverse items-start gap-4 sm:flex-row sm:justify-between sm:gap-6">
              <div className="max-w-lg space-y-4">
                <h1 className="font-heading text-4xl leading-[1.1] font-semibold text-foreground sm:text-5xl">
                  Everything before the downbeat.
                </h1>
                <p className="max-w-md text-base text-muted-foreground">
                  MD Tools turns a YouTube link or a rough recording into the exact
                  clip, click track, or stem you need. Before rehearsal starts, not
                  during it.
                </p>
              </div>
              <Image
                src="/erar-full.png"
                alt=""
                width={140}
                height={144}
                className="h-auto w-20 shrink-0 sm:w-24 lg:w-28"
                priority
              />
            </div>

            <FeatureSlider />
          </div>

          <div className="flex flex-col justify-center gap-6">
            <Card className="mx-auto w-full max-w-sm lg:mx-0">
              <CardHeader>
                <CardTitle>{sent ? "Check your inbox" : "Sign in"}</CardTitle>
                {sent ? (
                  <CardDescription className="flex items-center gap-2 pt-1">
                    <Image
                      src="/happy-logo.png"
                      alt=""
                      width={28}
                      height={28}
                      className="rounded-full"
                    />
                    We sent a sign-in link to {email}.
                  </CardDescription>
                ) : mode === "password" ? (
                  <CardDescription>Enter your username and password.</CardDescription>
                ) : (
                  <CardDescription>
                    Enter your email and we&rsquo;ll send a one-time link (no password
                    to remember).
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {!sent && (
                  <Tabs value={mode} onValueChange={(value) => setMode(value as "link" | "password")}>
                    <TabsList className="mb-4 w-full">
                      <TabsTrigger value="link" className="flex-1">
                        Email link
                      </TabsTrigger>
                      <TabsTrigger value="password" className="flex-1">
                        Username &amp; password
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="link">
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
                          <Select
                            value={affiliationId}
                            onValueChange={(value) => setAffiliationId(value ?? "")}
                          >
                            <SelectTrigger id="affiliation" className="w-full">
                              {/* base-ui's SelectValue renders the raw value (the id)
                                  unless given a children function to resolve the label. */}
                              <SelectValue placeholder={affiliationPlaceholder}>
                                {(value: string | null) =>
                                  affiliations?.find((a) => a.id === value)?.name ??
                                  affiliationPlaceholder
                                }
                              </SelectValue>
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
                        <div className="space-y-2">
                          <Label htmlFor="user-type">
                            Which of these describes you best? (optional)
                          </Label>
                          <Select
                            value={userTypeId}
                            onValueChange={(value) => setUserTypeId(value ?? "")}
                          >
                            <SelectTrigger id="user-type" className="w-full">
                              <SelectValue placeholder={userTypePlaceholder}>
                                {(value: string | null) =>
                                  userTypes?.find((t) => t.id === value)?.name ??
                                  userTypePlaceholder
                                }
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {userTypes?.map((t) =>
                                t.description ? (
                                  <Tooltip key={t.id}>
                                    <TooltipTrigger render={<SelectItem value={t.id} />}>
                                      {t.name}
                                    </TooltipTrigger>
                                    <TooltipContent side="right">{t.description}</TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.name}
                                  </SelectItem>
                                )
                              )}
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
                    </TabsContent>

                    <TabsContent value="password">
                      <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="username">Username</Label>
                          <Input
                            id="username"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="your-username"
                            autoComplete="username"
                            autoCapitalize="off"
                            autoCorrect="off"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="password">Password</Label>
                          <Input
                            id="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                          />
                        </div>
                        <Button type="submit" className="w-full" disabled={signingIn}>
                          {signingIn ? "Signing in…" : "Sign in"}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Set a username and password on your profile page first.
                        </p>
                      </form>
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>

            {!sent && (
              <div className="mx-auto w-full max-w-sm text-sm lg:mx-0">
                {!showRequestForm ? (
                  <button
                    type="button"
                    onClick={() => setShowRequestForm(true)}
                    className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Don&rsquo;t see your affiliation? Request it be added.
                  </button>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-heading text-base">
                        Request an affiliation
                      </CardTitle>
                      {requestSent ? (
                        <CardDescription className="flex items-center gap-2 pt-1">
                          <Image
                            src="/happy-logo.png"
                            alt=""
                            width={24}
                            height={24}
                            className="rounded-full"
                          />
                          Sent. An admin will review it.
                        </CardDescription>
                      ) : (
                        <CardDescription>An admin will review and approve it.</CardDescription>
                      )}
                    </CardHeader>
                    {!requestSent && (
                      <CardContent>
                        <form onSubmit={handleRequestAffiliation} className="space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor="request-name">Affiliation name</Label>
                            <Input
                              id="request-name"
                              required
                              value={requestName}
                              onChange={(e) => setRequestName(e.target.value)}
                              placeholder="e.g. Grace Community Choir"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="request-email">Your email</Label>
                            <Input
                              id="request-email"
                              type="email"
                              required
                              value={requestEmail}
                              onChange={(e) => setRequestEmail(e.target.value)}
                              placeholder="you@example.com"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="request-note">Note (optional)</Label>
                            <Input
                              id="request-note"
                              value={requestNote}
                              onChange={(e) => setRequestNote(e.target.value)}
                              placeholder="Anything that helps us verify you"
                            />
                          </div>
                          <Button type="submit" className="w-full" disabled={requestSending}>
                            {requestSending ? "Sending…" : "Submit request"}
                          </Button>
                        </form>
                      </CardContent>
                    )}
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
