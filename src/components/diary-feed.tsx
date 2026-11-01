import { CheckCircle2, ClipboardList, HardHat, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/client";
import { ENTRY_ICONS, PhotoGrid } from "@/components/shared";
import { Badge, cx, EmptyState } from "@/components/ui";
import { deleteEntry, resolveEntry } from "@/lib/actions/site";
import { ENTRY_TYPES } from "@/lib/constants";
import type { DiaryItem } from "@/lib/diary";
import { fmtDate, fmtDateTime, hours, relDay, timeAgo } from "@/lib/format";

export function DiaryFeed({ items, canModerate, currentUserId }: { items: DiaryItem[]; canModerate: boolean; currentUserId: number }) {
  if (!items.length) return <div className="card"><EmptyState icon={<ClipboardList className="size-5" />} title="Nothing recorded yet">Daily logs, notes, photos and inductions from site appear here.</EmptyState></div>;
  return (
    <div className="space-y-3">
      {items.map((it) => {
        if (it.kind === "log") {
          const sdl = it.labour.filter((l) => l.kind === "sdl");
          const kpr = it.labour.filter((l) => l.kind === "kpr");
          return (
            <article key={`l${it.id}`} className="card p-4">
              <header className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                  <ClipboardList className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">Daily log · {relDay(it.date)}</div>
                  <div className="text-xs text-muted">
                    {it.author}
                    {it.stage ? ` · ${it.stage}` : ""}
                    {it.weather ? ` · ${it.weather}` : ""}
                    {relDay(it.date) !== fmtDate(it.date, { weekday: true }) ? ` · ${fmtDate(it.date, { weekday: true })}` : ""}
                  </div>
                </div>
              </header>
              {it.workCompleted && <p className="prose-pre mt-3 text-sm">{it.workCompleted}</p>}
              {(sdl.length > 0 || kpr.length > 0 || it.subbiesOnSite) && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {sdl.map((l, i) => (
                    <Badge key={`s${i}`} tone="strong">
                      {l.name} · {hours(l.hours)}
                    </Badge>
                  ))}
                  {kpr.length > 0 && (
                    <Badge tone="warn">
                      KPR: {kpr.length} worker{kpr.length > 1 ? "s" : ""} · {hours(kpr.reduce((s, l) => s + l.hours, 0))}
                    </Badge>
                  )}
                  {it.subbiesOnSite && <Badge tone="info">On site: {it.subbiesOnSite}</Badge>}
                </div>
              )}
              {it.notes.map((n) => (
                <div
                  key={n.id}
                  className={cx(
                    "mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
                    n.resolvedAt ? "bg-subtle text-muted" : n.type === "issue" ? "bg-clay-soft text-clay-ink" : "bg-clay-soft text-clay-ink",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold">{ENTRY_TYPES[n.type as keyof typeof ENTRY_TYPES]?.label}: </span>
                    <span className="prose-pre">{n.body}</span>
                    {n.resolvedAt && <span className="ml-1 text-xs">(resolved)</span>}
                  </div>
                  {canModerate && (
                    <ActionButton action={resolveEntry.bind(null, n.id)} className="btn-ghost btn-sm -my-1 h-7 px-2 text-xs">
                      {n.resolvedAt ? "Reopen" : "Resolve"}
                    </ActionButton>
                  )}
                </div>
              ))}
              <PhotoGrid files={it.photos} className="mt-3" />
            </article>
          );
        }
        if (it.kind === "done") {
          return (
            <article key={`d${it.id}`} className="flex items-start gap-3 rounded-xl border border-dashed border-line-strong px-4 py-2.5">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-leaf" />
              <div className="min-w-0 flex-1 text-sm">
                <b>{it.text}</b>
                <span className="text-muted">
                  {it.by ? ` · ${it.by}` : ""} · {timeAgo(it.at)}
                </span>
                {it.items.length > 0 && <div className="mt-0.5 text-xs text-muted">{it.items.slice(0, 4).join(" · ")}{it.items.length > 4 ? ` · +${it.items.length - 4} more` : ""}</div>}
              </div>
            </article>
          );
        }
        if (it.kind === "induction") {
          return (
            <article key={`i${it.id}`} className="flex items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 py-2.5">
              <HardHat className="size-4 shrink-0 text-muted" />
              <div className="min-w-0 flex-1 text-sm">
                <b>{it.name}</b>
                {it.company ? ` (${it.company})` : ""} signed the site induction
                <span className="text-muted"> · {it.selfSigned ? "on their phone" : `with ${it.by ?? "supervisor"}`} · {timeAgo(it.at)}</span>
              </div>
            </article>
          );
        }
        const Icon = ENTRY_ICONS[it.type as keyof typeof ENTRY_ICONS] ?? ClipboardList;
        const def = ENTRY_TYPES[it.type as keyof typeof ENTRY_TYPES];
        const isIssue = it.type === "issue" || it.type === "unforeseen";
        return (
          <article key={`e${it.id}`} className="card p-4">
            <header className="flex items-start gap-3">
              <span
                className={cx(
                  "grid size-8 shrink-0 place-items-center rounded-full",
                  it.type === "issue" ? "bg-clay-ink text-cream" : it.type === "unforeseen" ? "bg-clay-soft text-clay-ink" : it.type === "client" ? "bg-olive-soft text-ink" : "bg-subtle text-muted",
                )}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{def?.label ?? it.type}</span>
                  {it.variationId && <Badge tone="strong">Flagged as variation</Badge>}
                  {isIssue && it.resolvedAt && (
                    <Badge tone="good">
                      <CheckCircle2 className="size-3" /> Resolved
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted" title={fmtDateTime(it.at)}>
                  {it.author} · {timeAgo(it.at)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {isIssue && canModerate && (
                  <ActionButton action={resolveEntry.bind(null, it.id)} className="btn-sm">
                    {it.resolvedAt ? "Reopen" : "Resolve"}
                  </ActionButton>
                )}
                {(canModerate || it.authorId === currentUserId) && (
                  <ActionButton action={deleteEntry.bind(null, it.id)} confirm="Delete this entry?" className="btn-ghost btn-icon btn-sm" title="Delete">
                    <Trash2 className="size-4 text-muted" />
                  </ActionButton>
                )}
              </div>
            </header>
            {it.body && <p className="prose-pre mt-3 text-sm">{it.body}</p>}
            <PhotoGrid files={it.photos} className="mt-3" />
          </article>
        );
      })}
    </div>
  );
}
