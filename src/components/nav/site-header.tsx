import Link from "next/link";
import { Logo } from "@/components/branding/logo";
import { UserMenu } from "@/components/nav/user-menu";

export function SiteHeader({
  email,
  displayName,
  avatarUrl,
  isAdmin,
}: {
  email: string;
  displayName: string | null;
  avatarUrl?: string | null;
  isAdmin?: boolean;
}) {
  return (
    <header className="flex items-center justify-between border-b border-border/60 bg-card/40 px-6 py-4">
      <Link href="/">
        <Logo />
      </Link>
      <UserMenu email={email} displayName={displayName} avatarUrl={avatarUrl} isAdmin={isAdmin} />
    </header>
  );
}
