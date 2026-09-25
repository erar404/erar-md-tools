import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <Image src="/sad-logo.png" alt="" width={160} height={168} priority />
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        That link is broken, or the page has moved. Let&apos;s get you back on track.
      </p>
      <Button render={<Link href="/" />}>Back to MD Tools</Button>
    </main>
  );
}
