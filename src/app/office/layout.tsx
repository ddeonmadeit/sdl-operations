import type { Metadata } from "next";
import Link from "next/link";
import { LogOut, Smartphone } from "lucide-react";
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <div className="grid size-8 place-items-center rounded-lg bg-accent text-[0.7rem] font-extrabold text-white">SDL</div>
          <div className="leading-tight">
            <div className="text-sm font-bold">SDL Creations</div>
            <div className="text-xs text-muted">Office</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <OfficeSideNav counts={counts} />
        </div>
        <div className="border-t border-line p-3">
          <Link href="/site" className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:bg-subtle">
            <Smartphone className="size-[18px]" /> Open site app
          </Link>
          <div className="flex items-center gap-2.5 px-3 py-2">
            <Avatar name={user.name} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-semibold">{user.name}</div>
              <div className="truncate text-xs text-muted">{user.email}</div>
            </div>
            <form action="/logout" method="post">
              <button className="btn btn-ghost btn-icon btn-sm" title="Sign out" aria-label="Sign out">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <header className="safe-top sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center gap-2.5 px-4">
          <div className="grid size-7 place-items-center rounded-md bg-accent text-[0.6rem] font-extrabold text-white">SDL</div>
          <div className="flex-1 text-sm font-bold">SDL Office</div>
          <Link href="/office/more" aria-label="Account">
            <Avatar name={user.name} />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">
        {children}
      </main>
      <OfficeTabBar counts={counts} />
    </div>
  );
}
