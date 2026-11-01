import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Tone } from "@/lib/constants";
import { initials } from "@/lib/format";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cx("badge", `tone-${tone}`, className)}>{children}</span>;
}

export function StatusBadge<T extends Record<string, { label: string; tone: Tone }>>({
  map,
  value,
}: {
  map: T;
  value: string;
}) {
  const def = map[value] ?? { label: value, tone: "neutral" as Tone };
  return <Badge tone={def.tone}>{def.label}</Badge>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: string;
  className?: string;
}) {
  return (
    <div className={cx("mb-5 flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {back && (
          <Link href={back} className="-ml-1 mb-1 inline-flex items-center gap-0.5 text-sm font-medium text-muted hover:text-ink">
            <ChevronLeft className="size-4" /> Back
          </Link>
        )}
        <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, title, action, pad = true }: {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  action?: React.ReactNode;
  pad?: boolean;
}) {
  return (
    <section className={cx("card overflow-hidden", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-[0.9375rem] font-semibold">{title}</h2>
          {action}
        </header>
      )}
      <div className={pad ? "p-4" : undefined}>{children}</div>
    </section>
  );
}

export function EmptyState({ icon, title, children, action }: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      {icon && <div className="mb-3 grid size-11 place-items-center rounded-full bg-subtle text-muted">{icon}</div>}
      <div className="font-semibold">{title}</div>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, href, tone }: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  href?: string;
  tone?: "default" | "warn" | "good" | "bad";
}) {
  const inner = (
    <>
      <div className="text-xs font-medium text-muted">{label}</div>
      <div
        className={cx(
          "mt-1 text-2xl font-bold tracking-tight tabular-nums",
          tone === "warn" && "text-clay",
          tone === "good" && "text-leaf",
          tone === "bad" && "text-clay",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="card block p-4 transition hover:border-line-strong">
      {inner}
    </Link>
  ) : (
    <div className="card p-4">{inner}</div>
  );
}

export function Avatar({ name, size = "md" }: { name?: string | null; size?: "sm" | "md" }) {
  return (
    <span
      className={cx(
        "inline-grid shrink-0 place-items-center rounded-full bg-accent-soft font-semibold text-accent",
        size === "sm" ? "size-6 text-[0.65rem]" : "size-8 text-xs",
      )}
      title={name ?? undefined}
    >
      {initials(name)}
    </span>
  );
}

export function Field({ label, hint, children, className }: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

export function RowLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cx("list-row", className)}>
      <div className="min-w-0 flex-1">{children}</div>
      <ChevronRight className="size-4 shrink-0 text-muted" />
    </Link>
  );
}

export function Tabs({ tabs, current }: { tabs: { href: string; label: string; count?: number }[]; current: string }) {
  return (
    <nav className="scrollbar-none -mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      {tabs.map((t) => {
        const active = t.href === current;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cx(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition",
              active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
            )}
            aria-current={active ? "page" : undefined}
          >
            {t.label}
            {t.count ? (
              <span className={cx("rounded-full px-1.5 text-[0.7rem] font-semibold", active ? "bg-accent text-cream" : "bg-subtle")}>
                {t.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cx("h-1.5 overflow-hidden rounded-full bg-subtle", className)}>
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${v}%` }} />
    </div>
  );
}

export function KV({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 text-right font-medium break-words">{v || <span className="text-muted">–</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
