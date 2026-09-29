"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Ported verbatim from dlp-gui's tip jar (dlp_gui/constants.py, TIP_NOTES).
const TIP_MESSAGES = [
  "Well, that download didn't torrent itself.\n\nIf this app just saved you from 14 sketchy \"free downloader\" sites, 3 pop-up ads, and a fake \"Your PC is infected!\" warning — consider tossing the developer a tip. It won't unlock any features, because there's nothing to unlock. It's just nice.\n\nNo pressure though — the Download button will keep working either way.",
  "ya, pembarya ya pangkain lang",
  "ser pangkape lang po",
  "God Bless you kapatid. Pwede ka rin mag LO dito. hahaha",
  "Para Sayo to, Rene",
  "Ser Tapos na po. Luma na rubber shoes ko.",
  "God Loves a cheerful giver",
  "Ui QR code, try mo scan tas lagay mo 500",
];

const ROTATE_MS = 4000;

export function TipJarModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [mood, setMood] = useState<"happy" | "sad">("happy");

  useEffect(() => {
    if (!open) return;
    // Randomizing which mascot/message shows is the whole point here, so
    // this genuinely needs to happen once per open, not be derived from
    // props during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMood(Math.random() < 0.5 ? "happy" : "sad");
    setMessageIndex(Math.floor(Math.random() * TIP_MESSAGES.length));
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % TIP_MESSAGES.length);
    }, ROTATE_MS);
    return () => clearInterval(interval);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <DialogHeader className="flex-1 gap-3">
            <DialogTitle className="font-heading">Download complete!</DialogTitle>
            <DialogDescription className="whitespace-pre-line">
              {TIP_MESSAGES[messageIndex]}
            </DialogDescription>
          </DialogHeader>

          {/* The tip-jar's own side of the dialog — bigger and set apart
              from the message, not a small thumbnail squeezed underneath it. */}
          <div className="flex shrink-0 flex-col items-center gap-3">
            <Image
              src="/brand-qrcode.png"
              alt="Tip jar QR code"
              width={208}
              height={208}
              className="rounded-md border border-border/60"
            />
            <div className="flex items-center gap-2">
              <Image
                src={mood === "happy" ? "/happy-logo.png" : "/sad-logo.png"}
                alt=""
                width={88}
                height={88}
                className="rounded-full"
              />
              <p className="text-xs text-muted-foreground">
                Scan to send a tip — thank you!
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
