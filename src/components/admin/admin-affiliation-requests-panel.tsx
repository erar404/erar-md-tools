"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AffiliationRequest } from "@/types/database";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function AdminAffiliationRequestsPanel() {
  const [requests, setRequests] = useState<AffiliationRequest[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const data = await fetch("/api/admin/affiliation-requests").then((r) => r.json());
    setRequests(data.requests ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleAction(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/affiliation-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      toast.success(action === "approve" ? "Affiliation approved and now allowed." : "Request rejected.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  const pending = requests?.filter((r) => r.status === "pending") ?? [];
  const resolved = requests?.filter((r) => r.status !== "pending") ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">Affiliation requests</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!requests ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Pending
              </p>
              {pending.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing pending.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {pending.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.requested_by_email} · {formatDate(r.created_at)}
                          {r.note ? ` · "${r.note}"` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={busyId === r.id}
                          onClick={() => handleAction(r.id, "approve")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === r.id}
                          onClick={() => handleAction(r.id, "reject")}
                        >
                          Reject
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {resolved.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Resolved
                </p>
                <ul className="divide-y divide-border/60">
                  {resolved.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span>{r.name}</span>
                      <span className="text-xs text-muted-foreground capitalize">{r.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
