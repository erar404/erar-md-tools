"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { LogOutIcon, UserIcon, LibraryIcon, ShieldIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const menuLinkClassName =
  "flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

// base-ui's Menu has a dedicated LinkItem (renders an <a>, unlike Item which
// expects a button-style action) — not re-exported by the shadcn wrapper, so
// wired up locally rather than hacking Link into DropdownMenuItem.
function DropdownMenuLinkItem({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <MenuPrimitive.LinkItem
      closeOnClick
      render={<Link href={href} />}
      className={cn(menuLinkClassName, className)}
    >
      {children}
    </MenuPrimitive.LinkItem>
  );
}

function initialsFor(label: string) {
  return label.trim().slice(0, 2).toUpperCase() || "?";
}

export function UserMenu({
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
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const label = displayName || email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-2 py-1 text-sm outline-none">
        <Avatar className="size-6">
          <AvatarImage src={avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="bg-primary/15 text-[10px] font-semibold text-primary">
            {initialsFor(label)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden max-w-32 truncate sm:inline">{label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* Static text, not an interactive group — base-ui's GroupLabel
            requires a <Menu.Group> ancestor, which this isn't. */}
        <div className="truncate px-1.5 py-1 text-xs font-medium text-muted-foreground">
          {email}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLinkItem href="/library">
          <LibraryIcon /> Library
        </DropdownMenuLinkItem>
        <DropdownMenuLinkItem href="/profile">
          <UserIcon /> Profile
        </DropdownMenuLinkItem>
        {isAdmin && (
          <DropdownMenuLinkItem href="/admin">
            <ShieldIcon /> Admin
          </DropdownMenuLinkItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
          <LogOutIcon /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
