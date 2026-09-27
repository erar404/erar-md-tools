"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Affiliation } from "@/types/database";

export function AdminAffiliationsPanel() {
  const [affiliations, setAffiliations] = useState<Affiliation[] | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await fetch("/api/admin/affiliations").then((r) => r.json());
    setAffiliations(data.affiliations ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/affiliations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add affiliation");
      setNewName("");
      toast.success("Affiliation added.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add affiliation");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(a: Affiliation) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/affiliations/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_allowed: !a.is_allowed }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Update failed");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
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
              <li key={a.id} className="flex items-center justify-between gap-2 py-3">
                <span className="font-medium">{a.name}</span>
                <div className="flex items-center gap-3">
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
