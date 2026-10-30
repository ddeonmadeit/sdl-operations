"use server";

import { and, eq, inArray, max } from "drizzle-orm";
import { db } from "@/db";
import { dailyLogs, entries, files, inductions, jobs, labourEntries, tasks, variations } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { isOffice, randomToken, requireOffice, requireUser } from "@/lib/auth";
import { ENTRY_TYPES, type EntryType } from "@/lib/constants";
import { fmtDate, today } from "@/lib/format";
import { bool, int, optDate, optStr, str, type ActionState } from "@/lib/form";
import { recordInduction } from "@/lib/induction";
import { refresh } from "./util";

const fileIds = (fd: FormData) =>
  fd
    .getAll("fileIds")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);

async function attachFiles(ids: number[], ownerType: string, ownerId: number, jobId: number) {
  if (!ids.length) return;
  await db.update(files).set({ ownerType, ownerId, jobId }).where(and(inArray(files.id, ids), eq(files.ownerType, "pending")));
}

/* ───────────── Daily log ───────────── */

export async function saveDailyLog(jobId: number, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const date = optDate(fd, "date") ?? today();

  const values = {
    workCompleted: optStr(fd, "workCompleted"),
    weather: optStr(fd, "weather"),
    subbiesOnSite: optStr(fd, "subbiesOnSite"),
    stageId: int(fd, "stageId"),
    updatedAt: new Date(),
  };
  const [existingLog] = await db
    .select({ id: dailyLogs.id })
    .from(dailyLogs)
    .where(and(eq(dailyLogs.jobId, jobId), eq(dailyLogs.date, date), eq(dailyLogs.authorId, user.id)));
  const [log] = await db
    .insert(dailyLogs)
    .values({ jobId, date, authorId: user.id, ...values })
    .onConflictDoUpdate({ target: [dailyLogs.jobId, dailyLogs.date, dailyLogs.authorId], set: values })
    .returning();

  // Labour hours: supervisor (SDL) hours + KPR workers
  const names = fd.getAll("labourName").map(String);
  const hrs = fd.getAll("labourHours").map((v) => parseFloat(String(v)));
  const kinds = fd.getAll("labourKind").map(String);
  const rows = names
    .map((name, i) => ({ name: name.trim(), hours: hrs[i] ?? NaN, kind: kinds[i] === "sdl" ? "sdl" : "kpr" }))
    .filter((r) => r.name && Number.isFinite(r.hours) && r.hours > 0);

  const old = await db.select().from(labourEntries).where(eq(labourEntries.dailyLogId, log!.id));
  await db.delete(labourEntries).where(eq(labourEntries.dailyLogId, log!.id));
  if (rows.length) {
    await db.insert(labourEntries).values(
      rows.map((r) => {
        // Keep an existing approval if the line hasn't changed.
        const prev = old.find((o) => o.kind === r.kind && o.name === r.name && o.hours === r.hours && o.approvedAt);
        return {
          jobId,
          dailyLogId: log!.id,
          date,
          kind: r.kind,
          userId: r.kind === "sdl" ? user.id : null,
          name: r.name,
          hours: r.hours,
          approvedAt: prev?.approvedAt ?? null,
          approvedById: prev?.approvedById ?? null,
        };
      }),
    );
  }

  // Issues and unforeseen items become diary entries so the office sees them.
  for (const type of ["issue", "unforeseen"] as const) {
    const body = str(fd, type);
    const [existing] = await db
      .select()
      .from(entries)
      .where(and(eq(entries.dailyLogId, log!.id), eq(entries.type, type)));
    if (body && existing) {
      if (existing.body !== body) await db.update(entries).set({ body }).where(eq(entries.id, existing.id));
    } else if (body) {
      await db.insert(entries).values({ jobId, type, body, authorId: user.id, dailyLogId: log!.id });
      await logActivity({ jobId, userId: user.id, kind: type, message: `${ENTRY_TYPES[type].label}: ${body.slice(0, 120)}` });
    } else if (existing) {
      await db.delete(entries).where(eq(entries.id, existing.id));
    }
  }

  await attachFiles(fileIds(fd), "log", log!.id, jobId);

  if (!existingLog) {
    await logActivity({ jobId, userId: user.id, kind: "log", message: `Daily log for ${fmtDate(date, { weekday: true })}` });
  }
  // Job is underway once logs are coming in.
  await db.update(jobs).set({ status: "in_progress" }).where(and(eq(jobs.id, jobId), eq(jobs.status, "won")));
  refresh();
  return { ok: true, message: "Daily log saved" };
}

/* ───────────── Notes / client conversations / issues ───────────── */

export async function addEntry(jobId: number, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const type = (str(fd, "type") || "note") as EntryType;
  if (!(type in ENTRY_TYPES)) return { error: "Unknown note type." };
  const body = str(fd, "body");
  const ids = fileIds(fd);
  if (!body && !ids.length) return { error: "Add some detail or a photo." };

  const [entry] = await db.insert(entries).values({ jobId, type, body, authorId: user.id }).returning();
  await attachFiles(ids, "entry", entry!.id, jobId);

  let msg = `${ENTRY_TYPES[type].label}${body ? `: ${body.slice(0, 120)}` : ` (${ids.length} photo${ids.length === 1 ? "" : "s"})`}`;

  // Client conversations can be flagged as a potential variation in one step.
  if (bool(fd, "flagVariation")) {
    const [m] = await db.select({ m: max(variations.number) }).from(variations).where(eq(variations.jobId, jobId));
    const title = str(fd, "variationTitle") || body.split("\n")[0]!.slice(0, 80) || "Potential variation";
    const [v] = await db
      .insert(variations)
      .values({
        jobId,
        number: (m?.m ?? 0) + 1,
        title,
        description: body,
        source: type === "client" ? "client" : "site",
        identifiedById: user.id,
        shareToken: `v_${randomToken(18)}`,
      })
      .returning();
    await db.update(entries).set({ variationId: v!.id }).where(eq(entries.id, entry!.id));
    msg += ` → flagged as variation V${v!.number}`;
  }

  // Optional follow-up task straight from the note.
  const taskTitle = str(fd, "taskTitle");
  if (taskTitle) {
    await db.insert(tasks).values({
      jobId,
      title: taskTitle,
      notes: body || null,
      assigneeId: int(fd, "taskAssigneeId"),
      dueDate: optDate(fd, "taskDueDate"),
      createdById: user.id,
    });
    msg += ` · follow-up: ${taskTitle}`;
  }

  await logActivity({ jobId, userId: user.id, kind: type, message: msg });
  refresh();
  return { ok: true, message: "Saved to the job diary" };
}

export async function resolveEntry(id: number): Promise<ActionState> {
  const user = await requireUser();
  const [e] = await db.select().from(entries).where(eq(entries.id, id));
  if (!e) return { error: "Not found." };
  await db
    .update(entries)
    .set({ resolvedAt: e.resolvedAt ? null : new Date(), resolvedById: e.resolvedAt ? null : user.id })
    .where(eq(entries.id, id));
  if (!e.resolvedAt) await logActivity({ jobId: e.jobId, userId: user.id, kind: "resolved", message: `Resolved: ${e.body.slice(0, 100)}` });
  refresh();
  return { ok: true, message: e.resolvedAt ? "Reopened" : "Marked as resolved" };
}

export async function deleteEntry(id: number): Promise<ActionState> {
  const user = await requireUser();
  const [e] = await db.select().from(entries).where(eq(entries.id, id));
  if (!e) return { error: "Not found." };
  if (e.authorId !== user.id && !isOffice(user)) return { error: "Only the author or the office can delete this." };
  await db.delete(entries).where(eq(entries.id, id));
  refresh();
  return { ok: true, message: "Deleted" };
}

/* ───────────── Inductions ───────────── */

export async function createInduction(jobId: number, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  return recordInduction(jobId, fd, false, user.id);
}

export async function deleteInduction(id: number): Promise<ActionState> {
  await requireOffice();
  await db.delete(inductions).where(eq(inductions.id, id));
  refresh();
  return { ok: true, message: "Induction removed" };
}
