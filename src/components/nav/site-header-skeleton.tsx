import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors SiteHeader's exact shape so a route's loading.tsx doesn't flash a
 * jarringly different header before the real one mounts. */
export function SiteHeaderSkeleton() {
  return (
    <header className="flex items-center justify-between border-b border-border/60 bg-card/40 px-6 py-4">
      <div className="flex items-center gap-2">
        <Skeleton className="size-6 rounded-md" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="size-8 rounded-full" />
    </header>
  );
}
