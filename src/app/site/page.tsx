import Link from "next/link";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { CheckCircle2, ChevronRight, ClipboardList, HardHat, MapPin } from "lucide-react";
import { Logo } from "@/components/brand";
import { Section } from "@/components/site/site-ui";
import { TaskList } from "@/components/shared";
import { cx, EmptyState, ProgressBar } from "@/components/ui";
import { db } from "@/db";
import { jobs, labourBookings, tasks, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { addDays, fmtDate, relDay, today } from "@/lib/format";
import { activeUsers } from "@/lib/queries";
import { siteJobs } from "@/lib/site";

export const metadata = { title: "Today" };

export default async function SiteToday() {
  const me = await requireUser();
  const t0 = today();
  const [myJobs, people, myTasks, bookings] = await Promise.all([
    siteJobs(me.id),
    activeUsers(),
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
      .where(and(eq(tasks.status, "open"), eq(tasks.assigneeId, me.id), lte(tasks.dueDate, addDays(t0, 1))))
      .orderBy(asc(tasks.dueDate)),
    db
      .select({ b: labourBookings, job: jobs.name })
      .from(labourBookings)
      .innerJoin(jobs, eq(jobs.id, labourBookings.jobId))
      .where(and(inArray(labourBookings.status, ["booked", "requested"]), gte(labourBookings.date, addDays(t0, -14)), lte(labourBookings.date, addDays(t0, 2))))
      .orderBy(asc(labourBookings.date)),
  ]);
  const mine = myJobs.filter((j) => j.mine);
  const others = myJobs.filter((j) => !j.mine);
  const kprSoon = bookings.filter((r) => addDays(r.b.date, r.b.days - 1) >= t0);

  return (
    <>
      <header className="mb-5 pt-2">
        <div className="mb-3 flex items-center justify-between">
          <Logo className="w-28" />
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">Site</span>
        </div>
        <div className="text-sm font-medium text-muted">{fmtDate(t0, { weekday: true })}</div>
        <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight">G&apos;day {me.name.split(" ")[0]}</h1>
      </header>

      <Section title={mine.length ? "My jobs" : "Active jobs"}>
        {myJobs.length === 0 ? (
          <div className="card">
            <EmptyState title="No active jobs">Jobs appear here once they&apos;re won.</EmptyState>
          </div>
        ) : (
          <div className="space-y-2.5">
            {(mine.length ? mine : others).map((j) => (
              <JobCard key={j.id} j={j} />
            ))}
          </div>
        )}
      </Section>

      {kprSoon.length > 0 && (
        <Section title="KPR labour">
          <div className="card divide-y divide-line">
            {kprSoon.map(({ b, job }) => (
              <Link key={b.id} href={`/site/jobs/${b.jobId}`} className="flex items-center gap-3 px-4 py-3">
                <HardHat className={cx("size-5 shrink-0", b.status === "booked" ? "text-leaf" : "text-muted")} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {b.workers} worker{b.workers > 1 ? "s" : ""} · {relDay(b.date)}
                    {b.days > 1 ? ` (+${b.days - 1}d)` : ""} · {b.startTime}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {job} · {b.status === "booked" ? "Confirmed" : "Waiting for office"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section title="Due for me" action={<Link href="/site/tasks" className="text-sm font-medium text-accent">All tasks</Link>}>
        <div className="card">
          <TaskList tasks={myTasks} users={people} currentUserId={me.id} jobHref={(id) => `/site/jobs/${id}`} empty="Nothing due today." />
        </div>
      </Section>

      {mine.length > 0 && others.length > 0 && (
        <Section title="Other active jobs">
          <div className="space-y-2.5">
            {others.map((j) => (
              <JobCard key={j.id} j={j} compact />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function JobCard({ j, compact }: { j: Awaited<ReturnType<typeof siteJobs>>[number]; compact?: boolean }) {
  return (
    <div className="card overflow-hidden">
      <Link href={`/site/jobs/${j.id}`} className="block p-4 active:bg-subtle">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">{j.name}</div>
            {j.siteAddress && (
              <div className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted">
                <MapPin className="size-3.5 shrink-0" /> {j.siteAddress}
              </div>
            )}
          </div>
          <ChevronRight className="mt-1 size-5 shrink-0 text-muted" />
        </div>
        {!compact && (
          <div className="mt-3">
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="font-medium text-ink-2">{j.currentStage ? j.currentStage.name : j.status === "won" ? "Starting soon" : "Finishing up"}</span>
              <span className="text-muted">{Math.round(j.progress * 100)}%</span>
            </div>
            <ProgressBar value={j.progress * 100} />
          </div>
        )}
      </Link>
      {!compact && (
        <Link
          href={`/site/jobs/${j.id}/log`}
          className={cx("flex items-center gap-2 border-t px-4 py-2.5 text-sm font-semibold", j.loggedToday ? "border-line bg-leaf-soft text-leaf" : "border-olive bg-olive text-cream")}
        >
          {j.loggedToday ? <CheckCircle2 className="size-4" /> : <ClipboardList className="size-4" />}
          {j.loggedToday ? "Today's log done – edit" : "Fill in today's daily log"}
        </Link>
      )}
    </div>
  );
}
