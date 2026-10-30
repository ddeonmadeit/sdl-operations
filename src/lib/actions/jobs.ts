"use server";

import { and, asc, eq, inArray, max } from "drizzle-orm";
import { db } from "@/db";
import { contacts, files, jobContacts, jobs, scopeItems, stages } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { randomToken, requireOffice, requireUser } from "@/lib/auth";
import { JOB_STATUSES, STAGE_STATUSES, STAGE_TEMPLATE, type JobStatus } from "@/lib/constants";
import { cents, int, optDate, optStr, str, type ActionState } from "@/lib/form";
import { deleteFile as deleteStoredFile } from "@/lib/storage";
import { refresh } from "./util";

type Result = ActionState & { redirect?: string };

/* ───────────── Jobs ───────────── */

export async function createJob(fd: FormData): Promise<Result> {
  const user = await requireOffice();
  const name = str(fd, "name");
  if (!name) return { error: "Give the job a name." };

  let clientId = int(fd, "clientId");
  const newClient = str(fd, "newClientName");
  if (!clientId && newClient) {
    const [c] = await db
      .insert(contacts)
      .values({ type: "client", name: newClient, phone: optStr(fd, "newClientPhone"), email: optStr(fd, "newClientEmail") })
      .returning({ id: contacts.id });
    clientId = c!.id;
  }

  const status = (str(fd, "status") || "enquiry") as JobStatus;
  const [job] = await db
    .insert(jobs)
    .values({
      name,
      clientId,
      siteAddress: optStr(fd, "siteAddress"),
      status: status in JOB_STATUSES ? status : "enquiry",
      source: optStr(fd, "source"),
      description: optStr(fd, "description"),
      estimatedValueCents: cents(fd, "estimatedValue"),
      supervisorId: int(fd, "supervisorId"),
      inductionToken: randomToken(16),
    })
    .returning({ id: jobs.id });

  // Standard SDL stages. "No pool" skips the pool-specific stages.
  const hasPool = fd.get("hasPool") !== "no";
  const template = STAGE_TEMPLATE.filter((s) => hasPool || !s.pool);
  await db.insert(stages).values(template.map((s, i) => ({ jobId: job!.id, name: s.name, kind: s.kind, sortOrder: i })));

  await logActivity({ jobId: job!.id, userId: user.id, kind: "job", message: `Enquiry created: ${name}` });
  refresh();
  return { ok: true, redirect: `/office/jobs/${job!.id}` };
}

export async function updateJob(jobId: number, fd: FormData): Promise<Result> {
  await requireOffice();
  const name = str(fd, "name");
  if (!name) return { error: "Job name is required." };
  await db
    .update(jobs)
    .set({
      name,
      clientId: int(fd, "clientId"),
      siteAddress: optStr(fd, "siteAddress"),
      source: optStr(fd, "source"),
      description: optStr(fd, "description"),
      estimatedValueCents: cents(fd, "estimatedValue"),
      contractValueCents: cents(fd, "contractValue"),
      supervisorId: int(fd, "supervisorId"),
      startDate: optDate(fd, "startDate"),
      targetDate: optDate(fd, "targetDate"),
      siteInfo: optStr(fd, "siteInfo"),
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId));
  refresh();
  return { ok: true };
}

export async function setJobStatus(jobId: number, fd: FormData): Promise<Result> {
  const user = await requireOffice();
  const status = str(fd, "status") as JobStatus;
  if (!(status in JOB_STATUSES)) return { error: "Unknown status." };
  await db
    .update(jobs)
    .set({
      status,
      completedAt: status === "completed" ? new Date() : null,
      lostReason: status === "lost" ? optStr(fd, "lostReason") : null,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId));
  await logActivity({ jobId, userId: user.id, kind: "status", message: `Status → ${JOB_STATUSES[status].label}` });
  refresh();
  return { ok: true };
}

export async function deleteJob(jobId: number): Promise<Result> {
  await requireOffice();
  await db.delete(jobs).where(eq(jobs.id, jobId));
  refresh();
  return { ok: true, redirect: "/office/jobs" };
}

export async function newInductionLink(jobId: number): Promise<Result> {
  await requireUser();
  await db.update(jobs).set({ inductionToken: randomToken(16) }).where(eq(jobs.id, jobId));
  refresh();
  return { ok: true, message: "New induction link created" };
}

/* ───────────── Stages / schedule ───────────── */

export async function addStage(jobId: number, fd: FormData): Promise<Result> {
  await requireOffice();
  const name = str(fd, "name");
  if (!name) return { error: "Stage name is required." };
  const [m] = await db.select({ m: max(stages.sortOrder) }).from(stages).where(eq(stages.jobId, jobId));
  await db.insert(stages).values({
    jobId,
    name,
    kind: str(fd, "kind") === "sdl" ? "sdl" : "subcontractor",
    contactId: int(fd, "contactId"),
    startDate: optDate(fd, "startDate"),
    endDate: optDate(fd, "endDate"),
    budgetCents: cents(fd, "budget"),
    sortOrder: (m?.m ?? 0) + 1,
  });
  refresh();
  return { ok: true };
}

export async function updateStage(stageId: number, fd: FormData): Promise<Result> {
  await requireOffice();
  const name = str(fd, "name");
  if (!name) return { error: "Stage name is required." };
  const startDate = optDate(fd, "startDate");
  const endDate = optDate(fd, "endDate");
  if (startDate && endDate && endDate < startDate) return { error: "Finish date is before the start date." };
  await db
    .update(stages)
    .set({
      name,
      kind: str(fd, "kind") === "sdl" ? "sdl" : "subcontractor",
      contactId: int(fd, "contactId"),
      startDate,
      endDate,
      budgetCents: cents(fd, "budget"),
      notes: optStr(fd, "notes"),
    })
    .where(eq(stages.id, stageId));
  refresh();
  return { ok: true };
}

export async function moveStage(stageId: number, dir: "up" | "down"): Promise<Result> {
  await requireOffice();
  const [stage] = await db.select().from(stages).where(eq(stages.id, stageId));
  if (!stage) return { error: "Stage not found." };
  const list = await db.select().from(stages).where(eq(stages.jobId, stage.jobId)).orderBy(asc(stages.sortOrder), asc(stages.id));
  const i = list.findIndex((s) => s.id === stageId);
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return { ok: true };
  [list[i], list[j]] = [list[j]!, list[i]!];
  await Promise.all(list.map((s, idx) => db.update(stages).set({ sortOrder: idx }).where(eq(stages.id, s.id))));
  refresh();
  return { ok: true };
}

export async function deleteStage(stageId: number): Promise<Result> {
  await requireOffice();
  await db.delete(stages).where(eq(stages.id, stageId));
  refresh();
  return { ok: true };
}

/** Site or office moves a stage along. Site marks "complete"; office signs off. */
export async function setStageStatus(stageId: number, status: keyof typeof STAGE_STATUSES): Promise<Result> {
  const user = await requireUser();
  if (status === "signed_off" && user.role === "supervisor") return { error: "Only the office can sign off a stage." };
  const [stage] = await db.select().from(stages).where(eq(stages.id, stageId));
  if (!stage) return { error: "Stage not found." };
  const now = new Date();
  await db
    .update(stages)
    .set({
      status,
      completedAt: status === "complete" ? now : status === "signed_off" ? (stage.completedAt ?? now) : null,
      completedById: status === "complete" ? user.id : status === "signed_off" ? (stage.completedById ?? user.id) : null,
      signedOffAt: status === "signed_off" ? now : null,
      signedOffById: status === "signed_off" ? user.id : null,
    })
    .where(eq(stages.id, stageId));

  // First stage started → job is in progress.
  if (status === "in_progress" || status === "complete") {
    await db
      .update(jobs)
      .set({ status: "in_progress", updatedAt: now })
      .where(and(eq(jobs.id, stage.jobId), inArray(jobs.status, ["won", "quoted", "quoting", "site_visit", "enquiry"])));
  }

  const msg =
    status === "complete"
      ? `${stage.name} marked complete – ready for office check`
      : status === "signed_off"
        ? `${stage.name} checked and signed off`
        : status === "in_progress"
          ? `${stage.name} started`
          : `${stage.name} reset to not started`;
  await logActivity({ jobId: stage.jobId, userId: user.id, kind: "stage", message: msg });
  refresh();
  return { ok: true };
}

/* ───────────── Scope of works ───────────── */

export async function addScopeItems(jobId: number, fd: FormData): Promise<Result> {
  await requireOffice();
  const stageId = int(fd, "stageId");
  // One item per line, so a whole scope can be pasted in at once.
  const lines = str(fd, "description")
    .split("\n")
    .map((l) => l.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter(Boolean);
  if (!lines.length) return { error: "Enter at least one scope item." };
  const [m] = await db.select({ m: max(scopeItems.sortOrder) }).from(scopeItems).where(eq(scopeItems.jobId, jobId));
  const start = (m?.m ?? 0) + 1;
  await db.insert(scopeItems).values(lines.map((description, i) => ({ jobId, stageId, description, sortOrder: start + i })));
  refresh();
  return { ok: true };
}

export async function toggleScopeItem(itemId: number): Promise<Result> {
  const user = await requireUser();
  const [item] = await db.select().from(scopeItems).where(eq(scopeItems.id, itemId));
  if (!item) return { error: "Item not found." };
  const done = !item.doneAt;
  await db
    .update(scopeItems)
    .set({ doneAt: done ? new Date() : null, doneById: done ? user.id : null })
    .where(eq(scopeItems.id, itemId));
  if (done) await logActivity({ jobId: item.jobId, userId: user.id, kind: "scope", message: `Completed: ${item.description}` });
  refresh();
  return { ok: true };
}

export async function updateScopeItem(itemId: number, fd: FormData): Promise<Result> {
  await requireOffice();
  const description = str(fd, "description");
  if (!description) return { error: "Description is required." };
  await db.update(scopeItems).set({ description, stageId: int(fd, "stageId") }).where(eq(scopeItems.id, itemId));
  refresh();
  return { ok: true };
}

export async function deleteScopeItem(itemId: number): Promise<Result> {
  await requireOffice();
  await db.delete(scopeItems).where(eq(scopeItems.id, itemId));
  refresh();
  return { ok: true };
}

/* ───────────── Job contacts (suppliers etc.) ───────────── */

export async function addJobContact(jobId: number, fd: FormData): Promise<Result> {
  await requireOffice();
  const contactId = int(fd, "contactId");
  if (!contactId) return { error: "Choose a contact." };
  await db.insert(jobContacts).values({ jobId, contactId, role: optStr(fd, "role") }).onConflictDoNothing();
  refresh();
  return { ok: true };
}

export async function removeJobContact(id: number): Promise<Result> {
  await requireOffice();
  await db.delete(jobContacts).where(eq(jobContacts.id, id));
  refresh();
  return { ok: true };
}

export async function assignStageContact(stageId: number, fd: FormData): Promise<Result> {
  await requireOffice();
  await db.update(stages).set({ contactId: int(fd, "contactId") }).where(eq(stages.id, stageId));
  refresh();
  return { ok: true };
}

/* ───────────── Plans & documents ───────────── */

export async function attachJobFiles(jobId: number, fd: FormData): Promise<Result> {
  const user = await requireOffice();
  const ids = fd.getAll("fileIds").map(Number).filter(Boolean);
  if (!ids.length) return { error: "Choose at least one file." };
  const category = str(fd, "category") === "plan" ? "plan" : "document";
  await db
    .update(files)
    .set({ ownerType: "job", ownerId: jobId, jobId, category })
    .where(and(inArray(files.id, ids), eq(files.ownerType, "pending")));
  await logActivity({ jobId, userId: user.id, kind: "files", message: `${ids.length} ${category === "plan" ? "plan" : "document"}${ids.length > 1 ? "s" : ""} uploaded` });
  refresh();
  return { ok: true, message: "Uploaded" };
}

export async function deleteJobFile(fileId: number): Promise<Result> {
  await requireOffice();
  const [f] = await db.delete(files).where(eq(files.id, fileId)).returning();
  if (f) await deleteStoredFile(f.storageKey);
  refresh();
  return { ok: true, message: "File deleted" };
}
