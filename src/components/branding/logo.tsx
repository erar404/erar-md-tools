import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ className, iconSize = 28 }: { className?: string; iconSize?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/favicons/favicon-64x64.png"
        alt=""
        width={iconSize}
        height={iconSize}
        className="rounded-full"
      />
      <span className="font-heading text-sm font-semibold tracking-tight text-foreground">
        MD Tools
      </span>
    </span>
  );
}
