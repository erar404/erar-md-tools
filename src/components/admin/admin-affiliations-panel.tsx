"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { withViewTransition } from "@/lib/view-transition";
import type { Affiliation } from "@/types/database";

export function AdminAffiliationsPanel() {
  const [affiliations, setAffiliations] = useState<Affiliation[] | null>(null);
  const [newName, setNewName] = useState("");
  const [newAvatarUrl, setNewAvatarUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await fetch("/api/admin/affiliations").then((r) => r.json());
    setAffiliations(data.affiliations ?? []);
  }

  useEffect(() => {
    // Intentional fetch-on-mount; `load` is also called again after
    // add/toggle/delete actions, so it stays a shared named function.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/affiliations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, avatar_url: newAvatarUrl || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add affiliation");
      setNewName("");
      setNewAvatarUrl("");
      toast.success("Affiliation added.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add affiliation");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(a: Affiliation) {
    // Optimistic: flip it in place immediately; roll back only on a real failure.
    withViewTransition(() =>
      setAffiliations(
        (prev) => prev?.map((x) => (x.id === a.id ? { ...x, is_allowed: !a.is_allowed } : x)) ?? null
      )
    );
    try {
      const res = await fetch(`/api/admin/affiliations/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_allowed: !a.is_allowed }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Update failed");
    } catch (err) {
      withViewTransition(() =>
        setAffiliations((prev) => prev?.map((x) => (x.id === a.id ? a : x)) ?? null)
      );
      toast.error(err instanceof Error ? err.message : "Update failed — reverted.");
    }
  }

  async function handleAvatarChange(a: Affiliation, avatarUrl: string) {
    setAffiliations(
      (prev) => prev?.map((x) => (x.id === a.id ? { ...x, avatar_url: avatarUrl || null } : x)) ?? null
    );
    try {
      const res = await fetch(`/api/admin/affiliations/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: avatarUrl || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Update failed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save avatar URL");
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/affiliations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Delete failed");
      toast.success("Affiliation deleted.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">Affiliations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            required
            placeholder="New affiliation name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input
            placeholder="Avatar URL (optional)"
            value={newAvatarUrl}
            onChange={(e) => setNewAvatarUrl(e.target.value)}
            className="max-w-56"
          />
          <Button type="submit" disabled={busy}>
            Add
          </Button>
        </form>

        {!affiliations ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : affiliations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None yet — nobody can sign in until at least one exists and is allowed.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {affiliations.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-2">
                  <Avatar className="size-8">
                    <AvatarImage src={a.avatar_url ?? undefined} alt="" />
                    <AvatarFallback className="bg-primary/15 text-xs text-primary">
                      {a.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{a.name}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    placeholder="Avatar URL"
                    defaultValue={a.avatar_url ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (a.avatar_url ?? "")) {
                        handleAvatarChange(a, e.target.value);
                      }
                    }}
                    className="h-8 w-48 text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={a.is_allowed}
                      onCheckedChange={() => handleToggle(a)}
                      disabled={busy}
                      id={`allowed-${a.id}`}
                    />
                    <label htmlFor={`allowed-${a.id}`} className="text-xs text-muted-foreground">
                      Allowed
                    </label>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    disabled={busy}
                    onClick={() => handleDelete(a.id)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
