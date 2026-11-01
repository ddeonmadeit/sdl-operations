"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "../ui";

export function JobTabs({ jobId, counts }: { jobId: number; counts: Record<string, number> }) {
  const path = usePathname();
  const base = `/office/jobs/${jobId}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/schedule`, label: "Schedule & labour", count: counts.schedule },
    { href: `${base}/scope`, label: "Scope of works" },
    { href: `${base}/quotes`, label: "Quotes & contracts" },
    { href: `${base}/variations`, label: "Variations", count: counts.variations },
    { href: `${base}/costs`, label: "Costs", count: counts.costs },
    { href: `${base}/diary`, label: "Site diary", count: counts.diary },
    { href: `${base}/files`, label: "Plans & files" },
  ];
  return (
    <nav className="scrollbar-none -mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
      {tabs.map((t) => {
        const active = t.href === base ? path === base : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            scroll={false}
            className={cx(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition",
              active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
            {t.count ? (
              <span className="rounded-full bg-clay-soft px-1.5 text-[0.7rem] font-semibold text-clay-ink">{t.count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
