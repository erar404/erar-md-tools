import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 p-6">
      <Image src="/brand-background.png" alt="MD Tools" width={160} height={160} priority />
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>MD Tools</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The YouTube-link / file-upload field, format picker, and &quot;Process&quot; flow land here in
          Phase 4, once Supabase (Phase 2) and the processor service (Phase 3) are wired up.
        </CardContent>
      </Card>
    </main>
  );
}
