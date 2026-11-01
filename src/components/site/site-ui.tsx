import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cx } from "@/components/ui";

/** Compact app-style header for site pages. */
export function SiteHeader({ title, sub, back, right }: { title: React.ReactNode; sub?: React.ReactNode; back?: string; right?: React.ReactNode }) {
  return (
    <header className="mb-4">
      {back && (
        <Link href={back} className="-ml-1.5 mb-1 inline-flex h-8 items-center gap-0.5 pr-2 text-sm font-medium text-muted active:text-ink">
          <ChevronLeft className="size-5" /> Back
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.6rem] leading-tight font-bold tracking-tight">{title}</h1>
          {sub && <div className="mt-0.5 text-sm text-muted">{sub}</div>}
        </div>
        {right}
      </div>
    </header>
  );
}

export function ActionTile({ href, icon, label, tone = "default", done }: { href: string; icon: React.ReactNode; label: string; tone?: "default" | "primary" | "warn"; done?: boolean }) {
  return (
    <Link
      href={href}
      className={cx(
        "relative flex flex-col items-start gap-2 rounded-2xl border p-3.5 transition active:scale-[0.97]",
        tone === "primary" ? "border-accent bg-accent text-cream" : tone === "warn" ? "border-clay/40 bg-clay-soft text-clay-ink" : "border-line bg-surface",
      )}
    >
      <span className={cx("grid size-9 place-items-center rounded-xl", tone === "primary" ? "bg-cream/15" : tone === "warn" ? "bg-clay/15" : "bg-subtle")}>{icon}</span>
      <span className="text-sm leading-tight font-semibold">{label}</span>
      {done && <span className="absolute top-2.5 right-2.5 rounded-full bg-cream px-1.5 text-[0.65rem] font-bold text-leaf">✓ Done</span>}
    </Link>
  );
}

export function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-xs font-bold tracking-wide text-muted uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
