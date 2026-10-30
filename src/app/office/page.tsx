import Link from "next/link";
import { and, asc, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { AlertTriangle, CheckCircle2, ChevronRight, FilePen, HardHat, Receipt, Timer } from "lucide-react";
import { ActivityFeed, AddTaskButton, TaskList } from "@/components/shared";
import { Card, cx, EmptyState, ProgressBar, Stat } from "@/components/ui";
import { db } from "@/db";
import { activity, bills, contacts, entries, jobs, labourBookings, labourEntries, stages, tasks, users, variations } from "@/db/schema";
import { requireOffice } from "@/lib/auth";
import { ACTIVE_STATUSES, BILL_KINDS, LEAD_STATUSES } from "@/lib/constants";
import { addDays, fmtDate, money, moneyShort, pct, relDay, timeAgo, today, weekStart } from "@/lib/format";
import { activeUsers, jobFinance, jobOptions } from "@/lib/queries";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const me = await requireOffice();
  const t0 = today();
  const wk = weekStart(t0);
  const wkEnd = addDays(wk, 13);

  const [allJobs, completeStages, newVars, openIssues, kprReqs, pendingBills, sdlPending, myTasks, people, jobList, weekStages, weekBookings, feed, openVars] =
    await Promise.all([
      db.select().from(jobs),
      db
        .select({ s: stages, job: jobs.name })
        .from(stages)
        .innerJoin(jobs, eq(jobs.id, stages.jobId))
        .where(eq(stages.status, "complete")),
      db
        .select({ v: variations, job: jobs.name })
        .from(variations)
        .innerJoin(jobs, eq(jobs.id, variations.jobId))
        .where(eq(variations.status, "identified"))
        .orderBy(desc(variations.createdAt)),
      db
        .select({ e: entries, job: jobs.name, author: users.name })
        .from(entries)
        .innerJoin(jobs, eq(jobs.id, entries.jobId))
        .leftJoin(users, eq(users.id, entries.authorId))
        .where(and(inArray(entries.type, ["issue", "unforeseen"]), isNull(entries.resolvedAt)))
        .orderBy(desc(entries.createdAt)),
      db
        .select({ b: labourBookings, job: jobs.name })
        .from(labourBookings)
        .innerJoin(jobs, eq(jobs.id, labourBookings.jobId))
        .where(eq(labourBookings.status, "requested"))
        .orderBy(asc(labourBookings.date)),
      db.select({ b: bills, contact: contacts.name }).from(bills).leftJoin(contacts, eq(contacts.id, bills.contactId)).where(eq(bills.status, "pending")),
      db
        .select({ hours: labourEntries.hours })
        .from(labourEntries)
        .where(and(eq(labourEntries.kind, "sdl"), isNull(labourEntries.approvedAt), gte(labourEntries.date, addDays(t0, -42)))),
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
          jobName: jobs.name,
        })
        .from(tasks)
        .leftJoin(users, eq(users.id, tasks.assigneeId))
        .leftJoin(jobs, eq(jobs.id, tasks.jobId))
        .where(and(eq(tasks.status, "open"), eq(tasks.assigneeId, me.id)))
        .orderBy(asc(tasks.dueDate))
        .limit(8),
      activeUsers(),
      jobOptions(),
      db
        .select({ s: stages, job: jobs.name, contact: contacts.name })
        .from(stages)
        .innerJoin(jobs, eq(jobs.id, stages.jobId))
        .leftJoin(contacts, eq(contacts.id, stages.contactId))
        .where(
          and(
            inArray(jobs.status, ACTIVE_STATUSES),
            inArray(stages.status, ["not_started", "in_progress"]),
            lte(stages.startDate, wkEnd),
            or(gte(stages.endDate, wk), isNull(stages.endDate)),
          ),
        )
        .orderBy(asc(stages.startDate)),
      db
        .select({ b: labourBookings, job: jobs.name })
        .from(labourBookings)
        .innerJoin(jobs, eq(jobs.id, labourBookings.jobId))
        .where(and(eq(labourBookings.status, "booked"), gte(labourBookings.date, addDays(t0, -7)), lte(labourBookings.date, wkEnd)))
        .orderBy(asc(labourBookings.date)),
      db
        .select({ a: activity, user: users.name, jobName: jobs.name })
        .from(activity)
        .leftJoin(users, eq(users.id, activity.userId))
        .leftJoin(jobs, eq(jobs.id, activity.jobId))
        .orderBy(desc(activity.createdAt))
        .limit(12),
      db.select().from(variations).where(inArray(variations.status, ["priced", "submitted"])),
    ]);

  const active = allJobs.filter((j) => ACTIVE_STATUSES.includes(j.status as never));
  const leads = allJobs.filter((j) => LEAD_STATUSES.includes(j.status as never));
  const fins = await Promise.all(active.map(async (j) => ({ job: j, fin: await jobFinance(j.id), stages: await db.select({ status: stages.status, name: stages.name }).from(stages).where(eq(stages.jobId, j.id)).orderBy(asc(stages.sortOrder)) })));
  const billTotal = pendingBills.reduce((s, r) => s + r.b.amountCents, 0);
  const sdlHours = sdlPending.reduce((s, r) => s + r.hours, 0);
  const incomingCount = completeStages.length + newVars.length + openIssues.length + kprReqs.length;
  const hour = Number(new Intl.DateTimeFormat("en-AU", { hour: "numeric", hourCycle: "h23", timeZone: process.env.APP_TIMEZONE || "Australia/Sydney" }).format(new Date()));

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          {hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}, {me.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted">{fmtDate(t0, { weekday: true, year: true })}</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active jobs" value={active.length} sub={`${moneyShort(active.reduce((s, j) => s + j.contractValueCents, 0))} under contract`} href="/office/jobs?view=active" />
        <Stat label="Leads in pipeline" value={leads.length} sub={`${moneyShort(leads.reduce((s, j) => s + j.estimatedValueCents, 0))} estimated`} href="/office/jobs?view=leads" />
        <Stat label="Invoices to check" value={pendingBills.length} sub={money(billTotal, true)} href="/office/approvals" tone={pendingBills.length ? "warn" : "default"} />
        <Stat
          label="Variations open"
          value={newVars.length + openVars.length}
          sub={`${moneyShort(openVars.reduce((s, v) => s + v.priceCents, 0))} awaiting approval`}
          href="/office/variations"
          tone={newVars.length ? "warn" : "default"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={`Incoming from site${incomingCount ? ` · ${incomingCount}` : ""}`} pad={false}>
          {incomingCount === 0 ? (
            <EmptyState icon={<CheckCircle2 className="size-5" />} title="All caught up" />
          ) : (
            <ul className="divide-y divide-line">
              {completeStages.map(({ s, job }) => (
                <InboxRow key={`s${s.id}`} href="/office/approvals?tab=work" icon={<CheckCircle2 className="size-5 text-amber-600" />} title={`${s.name} complete – check work`} meta={`${job} · ${s.completedAt ? timeAgo(s.completedAt) : ""}`} />
              ))}
              {newVars.map(({ v, job }) => (
                <InboxRow key={`v${v.id}`} href={`/office/jobs/${v.jobId}/variations`} icon={<FilePen className="size-5 text-violet-600" />} title={`New variation: ${v.title}`} meta={`${job} · needs pricing · ${timeAgo(v.createdAt)}`} />
              ))}
              {openIssues.map(({ e, job, author }) => (
                <InboxRow
                  key={`e${e.id}`}
                  href={`/office/jobs/${e.jobId}`}
                  icon={<AlertTriangle className={cx("size-5", e.type === "issue" ? "text-red-600" : "text-amber-600")} />}
                  title={e.body.length > 90 ? `${e.body.slice(0, 90)}…` : e.body}
                  meta={`${e.type === "issue" ? "Problem" : "Unforeseen"} · ${job} · ${author ?? ""} · ${timeAgo(e.createdAt)}`}
                />
              ))}
              {kprReqs.map(({ b, job }) => (
                <InboxRow
                  key={`b${b.id}`}
                  href="/office/approvals?tab=labour"
                  icon={<HardHat className="size-5 text-amber-600" />}
                  title={`KPR labour request: ${b.workers} × ${relDay(b.date)}${b.days > 1 ? ` (${b.days} days)` : ""}`}
                  meta={`${job} · book with KPR`}
                />
              ))}
            </ul>
          )}
        </Card>

        <Card title="To confirm for payment" pad={false} action={<Link href="/office/approvals" className="text-sm font-medium text-accent">Approvals</Link>}>
          <ul className="divide-y divide-line">
            {(["labour_hire", "subcontractor", "supplier"] as const).map((k) => {
              const list = pendingBills.filter((r) => r.b.kind === k);
              return (
                <InboxRow
                  key={k}
                  href="/office/approvals"
                  icon={<Receipt className={cx("size-5", list.length ? "text-blue-600" : "text-muted")} />}
                  title={BILL_KINDS[k]}
                  meta={list.length ? `${list.length} invoice${list.length > 1 ? "s" : ""} · ${money(list.reduce((s, r) => s + r.b.amountCents, 0), true)}` : "Nothing waiting"}
                />
              );
            })}
            <InboxRow
              href="/office/approvals?tab=hours"
              icon={<Timer className={cx("size-5", sdlHours ? "text-violet-600" : "text-muted")} />}
              title="SDL supervisor hours"
              meta={sdlHours ? `${sdlHours}h waiting approval` : "All approved"}
            />
          </ul>
        </Card>

        <Card title="My tasks" pad={false} action={<AddTaskButton users={people} jobs={jobList} currentUserId={me.id} />}>
          <TaskList tasks={myTasks} users={people} jobs={jobList} currentUserId={me.id} empty="No tasks assigned to you." />
          <Link href="/office/tasks" className="flex items-center justify-between border-t border-line px-4 py-2.5 text-sm font-medium text-accent">
            All tasks <ChevronRight className="size-4" />
          </Link>
        </Card>

        <Card title="This week & next" pad={false} action={<Link href="/office/schedule" className="text-sm font-medium text-accent">Schedule</Link>}>
          {weekStages.length === 0 && weekBookings.length === 0 ? (
            <EmptyState title="Nothing scheduled" />
          ) : (
            <ul className="divide-y divide-line">
              {weekStages.map(({ s, job, contact }) => (
                <li key={`s${s.id}`} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={cx("h-8 w-1 shrink-0 rounded-full", s.status === "in_progress" ? "bg-blue-600" : "bg-line-strong")} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {s.name} · {job}
                    </div>
                    <div className="truncate text-xs text-muted">
                      {contact ?? "SDL + KPR"} · {s.status === "in_progress" ? "underway" : `starts ${relDay(s.startDate)}`}
                      {s.endDate ? ` · finish ${relDay(s.endDate)}` : ""}
                    </div>
                  </div>
                </li>
              ))}
              {weekBookings
                .filter((r) => addDays(r.b.date, r.b.days - 1) >= t0)
                .map(({ b, job }) => (
                  <li key={`b${b.id}`} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="h-8 w-1 shrink-0 rounded-full bg-amber-500" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        KPR · {b.workers} worker{b.workers > 1 ? "s" : ""} · {job}
                      </div>
                      <div className="truncate text-xs text-muted">
                        {relDay(b.date)}
                        {b.days > 1 ? ` for ${b.days} days` : ""} · {b.task}
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <Card title="Active jobs" pad={false} className="lg:col-span-2">
          {fins.length === 0 ? (
            <EmptyState title="No active jobs" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-4 py-2 font-medium">Job</th>
                    <th className="px-3 py-2 font-medium">Stage</th>
                    <th className="px-3 py-2 text-right font-medium">Revenue</th>
                    <th className="px-3 py-2 text-right font-medium">Cost to date</th>
                    <th className="px-4 py-2 text-right font-medium">Forecast margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {fins.map(({ job, fin, stages: st }) => {
                    const done = st.filter((s) => s.status === "signed_off" || s.status === "complete").length;
                    const current = st.find((s) => s.status !== "signed_off" && s.status !== "complete");
                    return (
                      <tr key={job.id} className="hover:bg-subtle">
                        <td className="px-4 py-2.5">
                          <Link href={`/office/jobs/${job.id}`} className="font-medium hover:underline">
                            {job.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="text-xs">{current?.name ?? "Finishing"}</div>
                          <ProgressBar value={st.length ? (done / st.length) * 100 : 0} className="mt-1 w-28" />
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{money(fin.revenue, true)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{money(fin.actual, true)}</td>
                        <td className={cx("px-4 py-2.5 text-right font-semibold tabular-nums", fin.forecastMarginPct < 10 ? "text-red-700" : "text-green-700")}>
                          {fin.revenue ? pct(fin.forecastMarginPct) : "–"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Latest activity" className="lg:col-span-2">
          <ActivityFeed items={feed.map(({ a, user, jobName }) => ({ ...a, user, jobName }))} showJob />
        </Card>
      </div>
    </>
  );
}

function InboxRow({ href, icon, title, meta }: { href: string; icon: React.ReactNode; title: string; meta: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-4 py-3 transition hover:bg-subtle">
        <span className="shrink-0">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          <span className="block truncate text-xs text-muted">{meta}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted" />
      </Link>
    </li>
  );
}
