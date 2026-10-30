import { and, asc, desc, eq, ne } from "drizzle-orm";
import { Section, SiteHeader } from "@/components/site/site-ui";
import { AddTaskButton, TaskList } from "@/components/shared";
import { db } from "@/db";
import { jobs, tasks, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { activeUsers, jobOptions } from "@/lib/queries";

export const metadata = { title: "Tasks" };

const cols = {
  id: tasks.id,
  title: tasks.title,
  notes: tasks.notes,
  status: tasks.status,
  dueDate: tasks.dueDate,
  assigneeId: tasks.assigneeId,
  assigneeName: users.name,
  jobId: tasks.jobId,
  jobName: jobs.name,
};

export default async function SiteTasks() {
  const me = await requireUser();
  const [people, jobList, mine, delegated, done] = await Promise.all([
    activeUsers(),
    jobOptions(["won", "in_progress"]),
    db.select(cols).from(tasks).leftJoin(users, eq(users.id, tasks.assigneeId)).leftJoin(jobs, eq(jobs.id, tasks.jobId)).where(and(eq(tasks.status, "open"), eq(tasks.assigneeId, me.id))).orderBy(asc(tasks.dueDate)),
    db
      .select(cols)
      .from(tasks)
      .leftJoin(users, eq(users.id, tasks.assigneeId))
      .leftJoin(jobs, eq(jobs.id, tasks.jobId))
      .where(and(eq(tasks.status, "open"), eq(tasks.createdById, me.id), ne(tasks.assigneeId, me.id)))
      .orderBy(asc(tasks.dueDate)),
    db.select(cols).from(tasks).leftJoin(users, eq(users.id, tasks.assigneeId)).leftJoin(jobs, eq(jobs.id, tasks.jobId)).where(and(eq(tasks.status, "done"), eq(tasks.assigneeId, me.id))).orderBy(desc(tasks.doneAt)).limit(10),
  ]);
  const sortDue = <T extends { dueDate: string | null }>(l: T[]) => l.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const href = (id: number) => `/site/jobs/${id}`;
  return (
    <>
      <SiteHeader title="Tasks" right={<AddTaskButton users={people} jobs={jobList} currentUserId={me.id} className="btn btn-primary btn-sm" label="Task" />} />
      <Section title={`For me (${mine.length})`}>
        <div className="card">
          <TaskList tasks={sortDue(mine)} users={people} jobs={jobList} currentUserId={me.id} jobHref={href} empty="Nothing assigned to you." />
        </div>
      </Section>
      {delegated.length > 0 && (
        <Section title="I asked others">
          <div className="card">
            <TaskList tasks={sortDue(delegated)} users={people} jobs={jobList} currentUserId={me.id} jobHref={href} />
          </div>
        </Section>
      )}
      {done.length > 0 && (
        <Section title="Recently done">
          <div className="card">
            <TaskList tasks={done} users={people} jobs={jobList} currentUserId={me.id} jobHref={href} />
          </div>
        </Section>
      )}
    </>
  );
}
