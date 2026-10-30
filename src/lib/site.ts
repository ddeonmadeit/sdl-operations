import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { contacts, dailyLogs, jobs, stages } from "@/db/schema";
import { today } from "./format";

/** Jobs a supervisor works on: assigned to them first, then other active jobs. */
export async function siteJobs(userId: number) {
  const rows = await db
    .select({ job: jobs, client: contacts })
    .from(jobs)
    .leftJoin(contacts, eq(contacts.id, jobs.clientId))
    .where(inArray(jobs.status, ["won", "in_progress"]))
    .orderBy(asc(jobs.name));
  const ids = rows.map((r) => r.job.id);
  const [stageRows, logs] = await Promise.all([
    ids.length ? db.select().from(stages).where(inArray(stages.jobId, ids)).orderBy(asc(stages.sortOrder)) : Promise.resolve([]),
    ids.length
      ? db.select({ jobId: dailyLogs.jobId }).from(dailyLogs).where(and(inArray(dailyLogs.jobId, ids), eq(dailyLogs.date, today()), eq(dailyLogs.authorId, userId)))
      : Promise.resolve([]),
  ]);
  return rows
    .map(({ job, client }) => {
      const st = stageRows.filter((s) => s.jobId === job.id);
      const current = st.find((s) => s.status === "in_progress") ?? st.find((s) => s.status === "not_started");
      return {
        ...job,
        client,
        mine: job.supervisorId === userId,
        currentStage: current ?? null,
        progress: st.length ? st.filter((s) => s.status === "complete" || s.status === "signed_off").length / st.length : 0,
        loggedToday: logs.some((l) => l.jobId === job.id),
      };
    })
    .sort((a, b) => Number(b.mine) - Number(a.mine) || Number(b.status === "in_progress") - Number(a.status === "in_progress"));
}
