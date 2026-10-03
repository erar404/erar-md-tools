"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Logo } from "@/components/branding/logo";
import { withViewTransitionNav } from "@/lib/view-transition";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function EditHeaderTitle({ trackId, trackTitle }: { trackId: string; trackTitle: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  function goHome() {
    withViewTransitionNav(() => router.push("/"));
  }

  async function handleDiscard() {
    setDiscarding(true);
    try {
      const res = await fetch(`/api/tracks/${trackId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Could not discard this session");
      }
      setOpen(false);
      goHome();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not discard this session");
      setDiscarding(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-w-0 items-center gap-3 rounded-md text-left transition-opacity hover:opacity-80"
      >
        <Logo />
        <span className="hidden text-border/60 sm:inline">/</span>
        <h1 className="truncate font-heading text-base font-semibold text-foreground">
          {trackTitle}
        </h1>
      </button>

      <Dialog open={open} onOpenChange={(next) => !discarding && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave this session?</DialogTitle>
            <DialogDescription>
              Everything you&apos;ve already done to &ldquo;{trackTitle}&rdquo; (trims, click
              tracks, splits) is already saved. Keep it in your Library for later, or discard the
              whole session — the track and every file it produced — for good.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={discarding}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDiscard} loading={discarding}>
              Discard everything
            </Button>
            <Button
              onClick={() => {
                setOpen(false);
                goHome();
              }}
              disabled={discarding}
            >
              Save as draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
