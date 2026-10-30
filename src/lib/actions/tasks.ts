"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks, users } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import { relDay } from "@/lib/format";
import { int, optDate, optStr, str, type ActionState } from "@/lib/form";
import { refresh } from "./util";

export async function createTask(fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const title = str(fd, "title");
  if (!title) return { error: "What needs to be done?" };
  const jobId = int(fd, "jobId");
  const assigneeId = int(fd, "assigneeId") ?? user.id;
  const dueDate = optDate(fd, "dueDate");
  await db.insert(tasks).values({ jobId, title, notes: optStr(fd, "notes"), assigneeId, dueDate, createdById: user.id });
  if (jobId) {
    const [a] = await db.select({ name: users.name }).from(users).where(eq(users.id, assigneeId));
    await logActivity({
      jobId,
      userId: user.id,
      kind: "task",
      message: `Task for ${a?.name ?? "someone"}${dueDate ? ` (due ${relDay(dueDate)})` : ""}: ${title}`,
    });
  }
  refresh();
  return { ok: true, message: "Task added" };
}

export async function toggleTask(id: number): Promise<ActionState> {
  const user = await requireUser();
  const [t] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!t) return { error: "Task not found." };
  const done = t.status !== "done";
  await db
    .update(tasks)
    .set({ status: done ? "done" : "open", doneAt: done ? new Date() : null, doneById: done ? user.id : null })
    .where(eq(tasks.id, id));
  if (done && t.jobId) await logActivity({ jobId: t.jobId, userId: user.id, kind: "task", message: `Task done: ${t.title}` });
  refresh();
  return { ok: true };
}

export async function updateTask(id: number, fd: FormData): Promise<ActionState> {
  await requireUser();
  const title = str(fd, "title");
  if (!title) return { error: "Title is required." };
  await db
    .update(tasks)
    .set({ title, notes: optStr(fd, "notes"), assigneeId: int(fd, "assigneeId"), dueDate: optDate(fd, "dueDate"), jobId: int(fd, "jobId") })
    .where(eq(tasks.id, id));
  refresh();
  return { ok: true, message: "Task updated" };
}

export async function deleteTask(id: number): Promise<ActionState> {
  await requireUser();
  await db.delete(tasks).where(eq(tasks.id, id));
  refresh();
  return { ok: true, message: "Task deleted" };
}
