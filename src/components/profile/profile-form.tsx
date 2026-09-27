"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Affiliation, Profile } from "@/types/database";

export function ProfileForm({
  email,
  profile,
  affiliations,
}: {
  email: string;
  profile: Profile;
  affiliations: Affiliation[];
}) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [role, setRole] = useState(profile.role ?? "");
  const [affiliationId, setAffiliationId] = useState(profile.affiliation_id ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("profiles").upsert({
        id: profile.id,
        display_name: displayName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        role: role.trim() || null,
        affiliation_id: affiliationId || null,
      });
      if (error) throw error;
      toast.success("Profile saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Your profile</CardTitle>
        <CardDescription>Update how your details appear across MD Tools.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-14">
              <AvatarImage src={avatarUrl || undefined} alt="" />
              <AvatarFallback className="bg-primary/15 text-primary">
                {(displayName || email).slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Label htmlFor="avatar-url">Avatar URL</Label>
              <Input
                id="avatar-url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…/photo.jpg"
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
            <Label htmlFor="role">Role</Label>
            <Input
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Music Director, Vocalist, Drummer"
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="affiliation">Affiliation</Label>
            <Select value={affiliationId} onValueChange={(value) => setAffiliationId(value ?? "")}>
              <SelectTrigger id="affiliation" className="w-full">
                <SelectValue placeholder="Select your affiliation" />
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

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
