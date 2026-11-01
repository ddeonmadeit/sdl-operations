import type { Metadata } from "next";
import { RefreshOnReturn } from "@/components/app-shell";
import { SiteTabBar } from "@/components/nav";
import { requireUser } from "@/lib/auth";
import { navCounts } from "@/lib/counts";

export const metadata: Metadata = {
  title: { default: "Site", template: "%s · SDL Site" },
  manifest: "/site.webmanifest",
  appleWebApp: { capable: true, title: "SDL Site", statusBarStyle: "default" },
  icons: { apple: "/icons/site-apple.png" },
};

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const counts = await navCounts(user.id);
  return (
    <div className="min-h-dvh">
      <main className="safe-top mx-auto max-w-lg px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">{children}</main>
      <SiteTabBar counts={{ tasks: counts.tasks }} />
      <RefreshOnReturn />
    </div>
  );
}
