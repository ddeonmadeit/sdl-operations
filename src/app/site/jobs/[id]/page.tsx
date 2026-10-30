import Link from "next/link";
import { and, count, eq, isNotNull } from "drizzle-orm";
import {
  AlertTriangle,
  Camera,
  ChevronRight,
  ClipboardList,
  FilePen,
  FileText,
  HardHat,
  ListChecks,
  MapPin,
  MessageSquare,
  NotebookPen,
  Phone,
  Users,
  CalendarDays,
  UserPlus,
} from "lucide-react";
import { ActionButton } from "@/components/client";
import { ActionTile, Section, SiteHeader } from "@/components/site/site-ui";
import { cx, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { dailyLogs, files, inductions, scopeItems } from "@/db/schema";
import { setStageStatus } from "@/lib/actions/jobs";
import { requireUser } from "@/lib/auth";
import { STAGE_STATUSES } from "@/lib/constants";
import { fmtDate, telHref, today } from "@/lib/format";
import { getJob, jobStages } from "@/lib/queries";

export default async function SiteJob({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const job = await getJob(Number(id));
  const base = `/site/jobs/${job.id}`;
  const [stageRows, [scope], [scopeDone], [plans], [inducted], [logToday]] = await Promise.all([
    jobStages(job.id),
    db.select({ n: count() }).from(scopeItems).where(eq(scopeItems.jobId, job.id)),
    db.select({ n: count() }).from(scopeItems).where(and(eq(scopeItems.jobId, job.id), isNotNull(scopeItems.doneAt))),
    db.select({ n: count() }).from(files).where(and(eq(files.jobId, job.id), eq(files.ownerType, "job"))),
    db.select({ n: count() }).from(inductions).where(eq(inductions.jobId, job.id)),
    db.select({ n: count() }).from(dailyLogs).where(and(eq(dailyLogs.jobId, job.id), eq(dailyLogs.date, today()), eq(dailyLogs.authorId, me.id))),
  ]);
  const current = stageRows.find((s) => s.status === "in_progress") ?? stageRows.find((s) => s.status === "complete") ?? stageRows.find((s) => s.status === "not_started");
  const next = current ? stageRows[stageRows.indexOf(current) + 1] : undefined;

  return (
    <>
      <SiteHeader
        back="/site/jobs"
        title={job.name}
        sub={
          job.siteAddress && (
            <a href={`https://maps.google.com/?q=${encodeURIComponent(job.siteAddress)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent">
              <MapPin className="size-3.5" /> {job.siteAddress}
            </a>
          )
        }
        right={
          job.client?.phone ? (
            <a href={telHref(job.client.phone)} className="btn btn-icon shrink-0 rounded-full" aria-label="Call client">
              <Phone className="size-4" />
            </a>
          ) : null
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-2.5">
        <ActionTile href={`${base}/log`} icon={<ClipboardList className="size-5" />} label="Daily log" tone="primary" done={(logToday?.n ?? 0) > 0} />
        <ActionTile href={`${base}/induction`} icon={<UserPlus className="size-5" />} label="Induct a worker" />
        <ActionTile href={`${base}/note?type=photo`} icon={<Camera className="size-5" />} label="Photos / note" />
        <ActionTile href={`${base}/note?type=client`} icon={<MessageSquare className="size-5" />} label="Client conversation" />
        <ActionTile href={`${base}/note?type=issue`} icon={<AlertTriangle className="size-5 text-red-700" />} label="Problem / unforeseen" tone="warn" />
        <ActionTile href={`${base}/variation`} icon={<FilePen className="size-5" />} label="Potential variation" />
        <ActionTile href={`${base}/task`} icon={<NotebookPen className="size-5" />} label="Follow-up task" />
        <ActionTile href={`${base}/kpr`} icon={<HardHat className="size-5" />} label="Request KPR labour" />
      </div>

      {current && (
        <Section title="Current stage">
          <div className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold">{current.name}</div>
                <div className="text-sm text-muted">
                  {current.contact?.name ?? (current.kind === "sdl" ? "SDL + KPR" : "No subcontractor")}
                  {current.startDate ? ` · ${fmtDate(current.startDate)} – ${fmtDate(current.endDate)}` : ""}
                </div>
              </div>
              <StatusBadge map={STAGE_STATUSES} value={current.status} />
            </div>
            <div className="mt-3 flex gap-2">
              {current.status === "not_started" && (
                <ActionButton action={setStageStatus.bind(null, current.id, "in_progress")} className="btn-primary flex-1" success="Stage started">
                  Start stage
                </ActionButton>
              )}
              {current.status === "in_progress" && (
                <ActionButton
                  action={setStageStatus.bind(null, current.id, "complete")}
                  confirm={`Mark ${current.name} complete? The office will check it before paying.`}
                  className="btn-primary flex-1"
                  success="Sent to the office to check"
                >
                  Mark stage complete
                </ActionButton>
              )}
              {current.status === "complete" && <p className="text-sm text-amber-800">Waiting for the office to check and sign off.</p>}
              <Link href={`${base}/scope`} className="btn flex-1">
                Scope
              </Link>
            </div>
            {next && <p className="mt-3 border-t border-line pt-2.5 text-xs text-muted">Next: {next.name}{next.contact ? ` · ${next.contact.name}` : ""}{next.startDate ? ` · ${fmtDate(next.startDate, { weekday: true })}` : ""}</p>}
          </div>
        </Section>
      )}

      {job.siteInfo && (
        <div className="mb-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">
          <div className="mb-1 text-xs font-bold tracking-wide uppercase">Site info</div>
          <p className="prose-pre">{job.siteInfo}</p>
        </div>
      )}

      <Section title="Job info">
        <div className="card divide-y divide-line">
          {[
            { href: `${base}/scope`, icon: ListChecks, label: "Scope of works", meta: scope?.n ? `${scopeDone?.n ?? 0}/${scope.n} done` : "None yet" },
            { href: `${base}/schedule`, icon: CalendarDays, label: "Schedule & labour", meta: `${stageRows.length} stages` },
            { href: `${base}/plans`, icon: FileText, label: "Plans & documents", meta: `${plans?.n ?? 0}` },
            { href: `${base}/contacts`, icon: Users, label: "Contacts", meta: "" },
            { href: `${base}/diary`, icon: NotebookPen, label: "Site diary", meta: "" },
            { href: `${base}/induction`, icon: HardHat, label: "Induction register", meta: `${inducted?.n ?? 0} signed` },
          ].map(({ href, icon: Icon, label, meta }) => (
            <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3.5 active:bg-subtle">
              <Icon className="size-5 text-muted" />
              <span className="flex-1 font-medium">{label}</span>
              <span className={cx("text-sm text-muted")}>{meta}</span>
              <ChevronRight className="size-4 text-muted" />
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
