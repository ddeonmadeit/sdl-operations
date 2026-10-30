import { and, asc, desc, eq, type SQL } from "drizzle-orm";
import { AddTaskButton, TaskList } from "@/components/shared";
import { Card, PageHeader, Tabs } from "@/components/ui";
import { db } from "@/db";
import { jobs, tasks, users } from "@/db/schema";
import { requireOffice } from "@/lib/auth";
import { activeUsers, jobOptions } from "@/lib/queries";

export const metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string; who?: string }> }) {
  const me = await requireOffice();
  const { view = "mine", who } = await searchParams;
  const [people, jobList] = await Promise.all([activeUsers(), jobOptions()]);

  let where: SQL | undefined;
  if (view === "mine") where = and(eq(tasks.status, "open"), eq(tasks.assigneeId, me.id));
  else if (view === "all") where = and(eq(tasks.status, "open"), who ? eq(tasks.assigneeId, Number(who)) : undefined);
  else where = eq(tasks.status, "done");

  const rows = await db
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
    .where(where)
    .orderBy(view === "done" ? desc(tasks.doneAt) : asc(tasks.dueDate), asc(tasks.createdAt))
    .limit(200);

  // Undated tasks after dated ones
  if (view !== "done") rows.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Follow-ups from the office and site, with a responsible person and due date"
        actions={<AddTaskButton users={people} jobs={jobList} currentUserId={me.id} className="btn btn-primary" label="New task" />}
      />
      <Tabs
        current={`/office/tasks?view=${view}`}
        tabs={[
          { href: "/office/tasks?view=mine", label: "Mine" },
          { href: "/office/tasks?view=all", label: "Everyone" },
          { href: "/office/tasks?view=done", label: "Done" },
        ]}
      />
      {view === "all" && (
        <div className="scrollbar-none -mt-2 mb-4 flex gap-1.5 overflow-x-auto">
          <a href="/office/tasks?view=all" className={`shrink-0 rounded-full border px-3 py-1 text-sm ${!who ? "border-ink bg-ink text-white" : "border-line-strong bg-surface"}`}>
            Everyone
          </a>
          {people.map((p) => (
            <a key={p.id} href={`/office/tasks?view=all&who=${p.id}`} className={`shrink-0 rounded-full border px-3 py-1 text-sm ${who === String(p.id) ? "border-ink bg-ink text-white" : "border-line-strong bg-surface"}`}>
              {p.name}
            </a>
          ))}
        </div>
      )}
      <Card pad={false}>
        <TaskList tasks={rows} users={people} jobs={jobList} currentUserId={me.id} empty={view === "done" ? "No completed tasks yet." : "Nothing to do."} />
      </Card>
    </>
  );
}
