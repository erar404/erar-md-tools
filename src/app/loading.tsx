import { SiteHeaderSkeleton } from "@/components/nav/site-header-skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background animate-loading-in">
      <SiteHeaderSkeleton />
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <Card className="w-full max-w-xl">
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-9 w-full" />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
