import Link from "next/link";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { AlertTriangle, CheckCircle2, ChevronRight, FilePen, HardHat, Receipt } from "lucide-react";
import { ActionButton, ActionForm, Modal, SubmitButton } from "@/components/client";
import { ActivityFeed, AddTaskButton, TaskList } from "@/components/shared";
import { Card, cx, KV, ProgressBar, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { bills, contacts, entries, labourBookings, stages, tasks, users, variations } from "@/db/schema";
import { deleteJob } from "@/lib/actions/jobs";
import { resolveEntry } from "@/lib/actions/site";
import { setStageStatus } from "@/lib/actions/jobs";
import { requireOffice } from "@/lib/auth";
import { JOB_STATUSES } from "@/lib/constants";
import { fmtDate, money, pct, relDay, timeAgo } from "@/lib/format";
import { activeUsers, getJob, jobActivity, jobFinance } from "@/lib/queries";

export default async function JobOverview({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireOffice();
  const { id } = await params;
  const job = await getJob(Number(id));

  const [fin, stageRows, issues, kprReqs, newVars, pendingBills, taskRows, people, feed] = await Promise.all([
    jobFinance(job.id),
    db.select().from(stages).where(eq(stages.jobId, job.id)).orderBy(asc(stages.sortOrder)),
    db
      .select({ e: entries, author: users.name })
      .from(entries)
      .leftJoin(users, eq(users.id, entries.authorId))
      .where(and(eq(entries.jobId, job.id), inArray(entries.type, ["issue", "unforeseen"]), isNull(entries.resolvedAt)))
      .orderBy(desc(entries.createdAt)),
    db.select().from(labourBookings).where(and(eq(labourBookings.jobId, job.id), eq(labourBookings.status, "requested"))),
    db.select().from(variations).where(and(eq(variations.jobId, job.id), eq(variations.status, "identified"))),
    db
      .select({ b: bills, contact: contacts.name })
      .from(bills)
      .leftJoin(contacts, eq(contacts.id, bills.contactId))
      .where(and(eq(bills.jobId, job.id), eq(bills.status, "pending"))),
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        notes: tasks.notes,
        status: tasks.status,
        dueDate: tasks.dueDate,
        assigneeId: tasks.assigneeId,
        assigneeName: users.name,
        jobId: tasks.jobId,
      })
      .from(tasks)
      .leftJoin(users, eq(users.id, tasks.assigneeId))
      .where(and(eq(tasks.jobId, job.id), eq(tasks.status, "open")))
      .orderBy(asc(tasks.dueDate)),
    activeUsers(),
    jobActivity(job.id, 15),
  ]);

  const toCheck = stageRows.filter((s) => s.status === "complete");
  const doneStages = stageRows.filter((s) => s.status === "signed_off" || s.status === "complete").length;
  const current = stageRows.find((s) => s.status !== "signed_off" && s.status !== "complete");
  const attention = toCheck.length + issues.length + kprReqs.length + newVars.length + pendingBills.length;
  const base = `/office/jobs/${job.id}`;
  const isLead = ["enquiry", "site_visit", "quoting", "quoted"].includes(job.status);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-5">
        {attention > 0 && (
          <Card title="Needs attention" pad={false}>
            <ul className="divide-y divide-line">
              {toCheck.map((s) => (
                <li key={`s${s.id}`} className="flex items-center gap-3 px-4 py-3">
                  <CheckCircle2 className="size-5 shrink-0 text-clay" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{s.name} – marked complete on site</div>
                    <div className="text-xs text-muted">Check the work, then sign it off {s.completedAt ? `· ${timeAgo(s.completedAt)}` : ""}</div>
                  </div>
                  <ActionButton action={setStageStatus.bind(null, s.id, "signed_off")} className="btn-sm btn-primary" success="Signed off">
                    Sign off
                  </ActionButton>
                </li>
              ))}
              {issues.map(({ e, author }) => (
                <li key={`e${e.id}`} className="flex items-start gap-3 px-4 py-3">
                  <AlertTriangle className={cx("mt-0.5 size-5 shrink-0", e.type === "issue" ? "text-clay" : "text-clay")} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">{e.body}</div>
                    <div className="text-xs text-muted">
                      {e.type === "issue" ? "Problem" : "Unforeseen item"} · {author} · {timeAgo(e.createdAt)}
                    </div>
                  </div>
                  <ActionButton action={resolveEntry.bind(null, e.id)} className="btn-sm">
                    Resolve
                  </ActionButton>
                </li>
              ))}
              {newVars.map((v) => (
                <AttentionLink key={`v${v.id}`} href={`${base}/variations`} icon={<FilePen className="size-5 text-leaf" />}>
                  Variation V{v.number} needs pricing – {v.title}
                </AttentionLink>
              ))}
              {kprReqs.map((b) => (
                <AttentionLink key={`b${b.id}`} href={`${base}/schedule`} icon={<HardHat className="size-5 text-clay" />}>
                  KPR labour requested – {b.workers} worker{b.workers > 1 ? "s" : ""}, {fmtDate(b.date, { weekday: true })}
                  {b.days > 1 ? ` (${b.days} days)` : ""}
                </AttentionLink>
              ))}
              {pendingBills.map(({ b, contact }) => (
                <AttentionLink key={`i${b.id}`} href={`/office/approvals/${b.id}`} icon={<Receipt className="size-5 text-ink" />}>
                  Invoice to check – {contact} {money(b.amountCents)}
                </AttentionLink>
              ))}
            </ul>
          </Card>
        )}

        <Card
          title="Follow-up tasks"
          pad={false}
          action={<AddTaskButton users={people} jobId={job.id} currentUserId={me.id} />}
        >
          <TaskList tasks={taskRows.map((t) => ({ ...t, jobName: null }))} users={people} currentUserId={me.id} showJob={false} empty="No open tasks for this job." />
        </Card>

        <Card title="Recent activity" action={<Link href={`${base}/diary`} className="text-sm font-medium text-accent">Site diary</Link>}>
          <ActivityFeed items={feed.map(({ a, user }) => ({ ...a, user }))} />
        </Card>
      </div>

      <div className="space-y-5">
        {!isLead && (
          <Card title="Progress">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">{current ? current.name : job.status === "completed" ? "Completed" : "All stages done"}</span>
              <span className="text-muted">
                {doneStages}/{stageRows.length}
              </span>
            </div>
            <ProgressBar value={stageRows.length ? (doneStages / stageRows.length) * 100 : 0} />
            <Link href={`${base}/schedule`} className="mt-3 flex items-center justify-between text-sm font-medium text-accent">
              View schedule <ChevronRight className="size-4" />
            </Link>
          </Card>
        )}

        <Card title="Money" action={<Link href={`${base}/costs`} className="text-sm font-medium text-accent">Costs</Link>}>
          <KV
            items={[
              [isLead ? "Estimated value" : "Contract", money(isLead ? job.estimatedValueCents : fin.contract, true)],
              ["Approved variations", money(fin.variationRevenue, true)],
              ["Cost to date", money(fin.actual, true)],
              [
                "Forecast margin",
                fin.revenue ? (
                  <span className={fin.forecastMargin < 0 ? "text-clay" : "text-leaf"}>
                    {money(fin.forecastMargin, true)} · {pct(fin.forecastMarginPct)}
                  </span>
                ) : (
                  "–"
                ),
              ],
            ]}
          />
        </Card>

        <Card title="Details">
          <KV
            items={[
              ["Status", <StatusBadge key="s" map={JOB_STATUSES} value={job.status} />],
              ["Supervisor", job.supervisor?.name],
              ["Start", job.startDate ? relDay(job.startDate) : null],
              ["Target finish", job.targetDate ? fmtDate(job.targetDate, { year: true }) : null],
              ["Source", job.source],
              ["Created", fmtDate(job.createdAt.toISOString(), { year: true })],
            ]}
          />
          {job.description && <p className="prose-pre mt-4 border-t border-line pt-3 text-sm text-ink-2">{job.description}</p>}
          {job.siteInfo && (
            <div className="mt-3 rounded-lg bg-clay-soft p-3 text-sm text-ink">
              <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide">Site info</div>
              <p className="prose-pre">{job.siteInfo}</p>
            </div>
          )}
        </Card>

        <Modal title="Delete job" trigger="Delete job" triggerClassName="btn btn-ghost btn-danger btn-sm w-full">
          <p className="text-sm text-muted">
            This permanently deletes <b>{job.name}</b> and everything recorded against it (quotes, logs, photos, invoices). This can&apos;t be undone.
            To keep the history, set the status to Lost or Completed instead.
          </p>
          <ActionForm action={deleteJob.bind(null, job.id)} confirm="Delete this job permanently?">
            <SubmitButton className="btn-primary mt-4 w-full bg-clay-ink border-clay-ink">Delete permanently</SubmitButton>
          </ActionForm>
        </Modal>
      </div>
    </div>
  );
}

function AttentionLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-4 py-3 transition hover:bg-subtle">
        <span className="shrink-0">{icon}</span>
        <span className="min-w-0 flex-1 text-sm font-medium">{children}</span>
        <ChevronRight className="size-4 text-muted" />
      </Link>
    </li>
  );
}
