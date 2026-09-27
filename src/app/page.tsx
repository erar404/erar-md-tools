import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LandingFlow } from "@/components/landing/landing-flow";
import { Logo } from "@/components/branding/logo";

export default function LandingPage() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 p-6">
      <Logo iconSize={36} className="text-base" />
      <Image src="/brand-background.png" alt="" width={140} height={140} priority />
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="font-heading">MD Tools</CardTitle>
          <CardDescription>
            Paste a YouTube link or drop an audio file below, then press Process.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LandingFlow />
        </CardContent>
      </Card>
    </main>
  );
}
