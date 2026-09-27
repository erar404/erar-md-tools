"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Affiliation, Profile } from "@/types/database";

type AdminUser = Profile & { email: string };

export function AdminUsersPanel() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [affiliations, setAffiliations] = useState<Affiliation[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<AdminUser>>({});
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [usersRes, affiliationsRes] = await Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/affiliations").then((r) => r.json()),
    ]);
    setUsers(usersRes.users ?? []);
    setAffiliations(affiliationsRes.affiliations ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  function startEdit(user: AdminUser) {
    setEditingId(user.id);
    setDraft({
      display_name: user.display_name,
      role: user.role,
      avatar_url: user.avatar_url,
      affiliation_id: user.affiliation_id,
      is_admin: user.is_admin,
    });
  }

  async function handleSave(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success("User updated.");
      setEditingId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      toast.success("User removed.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add user");
      toast.success("User added — they can sign in with the login form now.");
      setNewEmail("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add user");
    } finally {
      setBusy(false);
    }
  }

  function affiliationName(id: string | null) {
    return affiliations.find((a) => a.id === id)?.name ?? "—";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">Users</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            type="email"
            required
            placeholder="new.teammate@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <Button type="submit" disabled={busy}>
            Add user
          </Button>
        </form>

        {!users ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {users.map((user) => (
              <li key={user.id} className="py-3">
                {editingId === user.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Display name</Label>
                        <Input
                          value={draft.display_name ?? ""}
                          onChange={(e) => setDraft((d) => ({ ...d, display_name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Role</Label>
                        <Input
                          value={draft.role ?? ""}
                          onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Affiliation</Label>
                      <Select
                        value={draft.affiliation_id ?? ""}
                        onValueChange={(value) =>
                          setDraft((d) => ({ ...d, affiliation_id: value || null }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="None" />
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
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={draft.is_admin ?? false}
                        onCheckedChange={(checked) => setDraft((d) => ({ ...d, is_admin: checked }))}
                        id={`admin-${user.id}`}
                      />
                      <Label htmlFor={`admin-${user.id}`}>Admin</Label>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy} onClick={() => handleSave(user.id)}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {user.display_name || user.email}
                        {user.is_admin && (
                          <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            ADMIN
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user.email} · {user.role || "no role set"} ·{" "}
                        {affiliationName(user.affiliation_id)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(user)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        disabled={busy}
                        onClick={() => handleDelete(user.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
