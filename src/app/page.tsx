import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LandingFlow } from "@/components/landing/landing-flow";

export default function LandingPage() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 p-6">
      <Image src="/brand-background.png" alt="MD Tools" width={160} height={160} priority />
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>MD Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <LandingFlow />
        </CardContent>
      </Card>
    </main>
  );
}
