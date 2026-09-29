"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { removeAvatar, uploadAvatar } from "@/lib/storage-client";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { withViewTransition } from "@/lib/view-transition";
import type { Affiliation, Profile, UserType } from "@/types/database";

export function ProfileForm({
  email,
  profile,
  affiliations,
  userTypes,
}: {
  email: string;
  profile: Profile;
  affiliations: Affiliation[];
  userTypes: UserType[];
}) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [userTypeId, setUserTypeId] = useState(profile.user_type_id ?? "");
  const [affiliationId, setAffiliationId] = useState(profile.affiliation_id ?? "");
  const [username, setUsername] = useState(profile.username ?? "");
  const [saving, setSaving] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [mustChangePassword, setMustChangePassword] = useState(profile.must_change_password);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const selectedType = userTypes.find((t) => t.id === userTypeId);
  const selectedAffiliation = affiliations.find((a) => a.id === affiliationId);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    // Optimistic: the fields are already showing what the user picked, so the
    // save just needs to confirm instantly rather than make them wait on a
    // round-trip. Only a real failure rolls the fields back.
    const previous = {
      displayName: profile.display_name ?? "",
      avatarUrl: profile.avatar_url ?? "",
      userTypeId: profile.user_type_id ?? "",
      affiliationId: profile.affiliation_id ?? "",
      username: profile.username ?? "",
    };
    const toastId = toast.success("Profile saved.");
    withViewTransition(() => setSaving(true));

    try {
      const supabase = createClient();
      const { error } = await supabase.from("profiles").upsert({
        id: profile.id,
        display_name: displayName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        user_type_id: userTypeId || null,
        affiliation_id: affiliationId || null,
        username: username.trim().toLowerCase() || null,
      });
      if (error) throw error;
    } catch (err) {
      toast.dismiss(toastId);
      withViewTransition(() => {
        setDisplayName(previous.displayName);
        setAvatarUrl(previous.avatarUrl);
        setUserTypeId(previous.userTypeId);
        setAffiliationId(previous.affiliationId);
        setUsername(previous.username);
      });
      toast.error(
        err instanceof Error
          ? err.message.includes("profiles_username_lower_idx")
            ? "That username is taken. Try another."
            : err.message
          : "Could not save, your changes were reverted."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image is too large — max 5MB.");
      return;
    }
    setUploadingAvatar(true);
    try {
      const supabase = createClient();
      const publicUrl = await uploadAvatar(supabase, profile.id, file);
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile.id);
      if (error) throw error;
      withViewTransition(() => setAvatarUrl(publicUrl));
      toast.success("Photo updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload photo");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    setUploadingAvatar(true);
    try {
      const supabase = createClient();
      await removeAvatar(supabase, profile.id);
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", profile.id);
      if (error) throw error;
      withViewTransition(() => setAvatarUrl(""));
      toast.success("Photo removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove photo");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    setChangingPassword(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
      if (authError) throw authError;

      if (mustChangePassword) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ must_change_password: false })
          .eq("id", profile.id);
        if (profileError) throw profileError;
        withViewTransition(() => setMustChangePassword(false));
      }

      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="space-y-4">
      {mustChangePassword && (
        <div className="rounded-md border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground">
          An admin reset your password. Set a new one below before you continue.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Your profile</CardTitle>
          <CardDescription>Update how your details appear across MD Tools.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="size-14">
                <AvatarImage src={avatarUrl || undefined} alt="" />
                <AvatarFallback className="bg-primary/15 text-primary">
                  {(displayName || email).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {selectedAffiliation?.avatar_url && (
                <Avatar className="absolute -bottom-1 -right-1 size-6 border-2 border-card">
                  <AvatarImage src={selectedAffiliation.avatar_url} alt="" />
                  <AvatarFallback className="text-[9px]">
                    {selectedAffiliation.name.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <Label>Photo</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => avatarInputRef.current?.click()}
                  loading={uploadingAvatar}
                >
                  {uploadingAvatar ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
                </Button>
                {avatarUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    disabled={uploadingAvatar}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleAvatarFile(file);
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How should we address you?"
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="For signing in with a password instead of an email link"
              maxLength={40}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-type">Which of these describes you best?</Label>
            <Select value={userTypeId} onValueChange={(value) => setUserTypeId(value ?? "")}>
              <SelectTrigger id="user-type" className="w-full">
                {/* base-ui's SelectValue renders the raw value (the id)
                    unless given a children function to resolve the label. */}
                <SelectValue placeholder="Select a type">
                  {(value: string | null) =>
                    userTypes.find((t) => t.id === value)?.name ?? "Select a type"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {userTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedType?.description && (
              <p className="text-xs text-muted-foreground">{selectedType.description}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="affiliation">Affiliation</Label>
            <Select value={affiliationId} onValueChange={(value) => setAffiliationId(value ?? "")}>
              <SelectTrigger id="affiliation" className="w-full">
                <SelectValue placeholder="Select your affiliation">
                  {(value: string | null) =>
                    affiliations.find((a) => a.id === value)?.name ?? "Select your affiliation"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {affiliations.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" loading={saving} className="w-full">
            {saving ? "Saving…" : "Save changes"}
          </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Password</CardTitle>
          <CardDescription>
            {profile.username
              ? "Sign in with your username and a password instead of waiting on an email link."
              : "Save a username above first, then add a password here."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
              />
            </div>
            <Button
              type="submit"
              disabled={!profile.username || !newPassword}
              loading={changingPassword}
              className="w-full"
            >
              {changingPassword ? "Updating…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
