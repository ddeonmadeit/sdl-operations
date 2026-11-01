import type { Metadata } from "next";
import Link from "next/link";
import { LogOut, Smartphone } from "lucide-react";
import { RefreshOnReturn } from "@/components/app-shell";
import { Logo } from "@/components/brand";
import { OfficeSideNav, OfficeTabBar } from "@/components/nav";
import { Avatar } from "@/components/ui";
import { requireOffice } from "@/lib/auth";
import { navCounts } from "@/lib/counts";

export const metadata: Metadata = {
  title: { default: "Office", template: "%s · SDL Office" },
  manifest: "/office.webmanifest",
  appleWebApp: { capable: true, title: "SDL Office", statusBarStyle: "default" },
  icons: { apple: "/icons/office-apple.png" },
};

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOffice();
  const counts = await navCounts(user.id);
  return (
    <div className="min-h-dvh lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-olive text-cream lg:flex">
        <Link href="/office" className="block px-6 pt-6 pb-5" aria-label="SDL Creations – dashboard">
          <Logo variant="cream" className="w-36" />
        </Link>
        <div className="flex-1 overflow-y-auto px-3 py-1">
          <OfficeSideNav counts={counts} />
        </div>
        <div className="border-t border-cream/15 p-3">
          <Link href="/site" className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-cream/75 transition hover:bg-cream/10 hover:text-cream">
            <Smartphone className="size-[18px]" /> Open site app
          </Link>
          <div className="flex items-center gap-2.5 px-3 py-2">
            <span className="inline-grid size-8 shrink-0 place-items-center rounded-full bg-cream/15 text-xs font-semibold text-cream">
              {user.name
                .split(/\s+/)
                .slice(0, 2)
                .map((p) => p[0])
                .join("")
                .toUpperCase()}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-semibold">{user.name}</div>
              <div className="truncate text-xs text-cream/60">{user.email}</div>
            </div>
            <form action="/logout" method="post">
              <button className="grid size-8 place-items-center rounded-lg text-cream/70 transition hover:bg-cream/10 hover:text-cream" title="Sign out" aria-label="Sign out">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <header className="safe-top sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center gap-2.5 px-4">
          <Link href="/office" className="flex items-center gap-3" aria-label="Dashboard">
            <Logo className="w-[84px]" />
            <span className="border-l border-line-strong pl-3 text-xs font-semibold tracking-wide text-muted uppercase">Office</span>
          </Link>
          <div className="flex-1" />
          <Link href="/office/more" aria-label="Account">
            <Avatar name={user.name} />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">
        {children}
      </main>
      <OfficeTabBar counts={counts} />
      <RefreshOnReturn />
    </div>
  );
}
