"use server";

import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, contracts, jobs, scopeItems, stages } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { randomToken, requireOffice } from "@/lib/auth";
import { cents, int, optStr, str, type ActionState } from "@/lib/form";
import { getSetting } from "@/lib/settings";
import { refresh } from "./util";

type Result = ActionState & { redirect?: string };

export async function createContract(jobId: number, fd: FormData): Promise<Result> {
  const user = await requireOffice();
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) return { error: "Job not found." };
  const templates = await getSetting("templates");
  const kind = str(fd, "kind") === "subcontract" ? "subcontract" : "client";

  if (kind === "client") {
    const [c] = await db
      .insert(contracts)
      .values({
        jobId,
        kind,
        contactId: job.clientId,
        title: `Contract – ${job.name}`,
        scope: job.description,
        amountCents: job.contractValueCents,
        terms: templates.clientContractTerms,
        shareToken: `c_${randomToken(18)}`,
      })
      .returning({ id: contracts.id });
    await logActivity({ jobId, userId: user.id, kind: "contract", message: "Client contract drafted" });
    refresh();
    return { ok: true, redirect: `/office/contracts/${c!.id}` };
  }

  // Subcontractor agreement – prefilled from the stage (scope items, budget, assigned subbie)
  const stageId = int(fd, "stageId");
  const [stage] = stageId ? await db.select().from(stages).where(eq(stages.id, stageId)) : [];
  const contactId = int(fd, "contactId") ?? stage?.contactId ?? null;
  if (!contactId) return { error: "Choose the subcontractor." };
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId));
  const scope = stage
    ? (await db.select().from(scopeItems).where(eq(scopeItems.stageId, stage.id)).orderBy(asc(scopeItems.sortOrder)))
        .map((s) => `• ${s.description}`)
        .join("\n")
    : "";

  if (stage && !stage.contactId) await db.update(stages).set({ contactId }).where(eq(stages.id, stage.id));

  const [c] = await db
    .insert(contracts)
    .values({
      jobId,
      kind,
      contactId,
      stageId: stage?.id ?? null,
      title: `${stage?.name ?? "Subcontract works"} – ${job.name}`,
      scope: scope || null,
      amountCents: stage?.budgetCents ?? 0,
      terms: templates.subcontractTerms,
      shareToken: `c_${randomToken(18)}`,
    })
    .returning({ id: contracts.id });
  await logActivity({ jobId, userId: user.id, kind: "contract", message: `Subcontract agreement drafted for ${contact?.name ?? "subcontractor"}` });
  refresh();
  return { ok: true, redirect: `/office/contracts/${c!.id}` };
}

export async function updateContract(id: number, fd: FormData): Promise<Result> {
  await requireOffice();
  const [c] = await db.select().from(contracts).where(eq(contracts.id, id));
  if (!c) return { error: "Not found." };
  if (c.status === "signed") return { error: "This has been signed and can't be edited. Cancel it and create a new one." };
  await db
    .update(contracts)
    .set({
      title: str(fd, "title") || c.title,
      contactId: int(fd, "contactId"),
      stageId: int(fd, "stageId"),
      scope: optStr(fd, "scope"),
      amountCents: cents(fd, "amount"),
      terms: optStr(fd, "terms"),
    })
    .where(eq(contracts.id, id));
  refresh();
  return { ok: true, message: "Saved" };
}

export async function setContractStatus(id: number, status: "draft" | "signed" | "cancelled"): Promise<Result> {
  const user = await requireOffice();
  const [c] = await db
    .update(contracts)
    .set({ status, signedAt: status === "signed" ? new Date() : null })
    .where(eq(contracts.id, id))
    .returning();
  if (!c) return { error: "Not found." };
  if (c.kind === "client" && status === "signed") {
    await db.update(jobs).set({ contractValueCents: c.amountCents, updatedAt: new Date() }).where(eq(jobs.id, c.jobId));
  }
  await logActivity({ jobId: c.jobId, userId: user.id, kind: "contract", message: `${c.title} marked ${status}` });
  refresh();
  return { ok: true };
}

export async function deleteContract(id: number): Promise<Result> {
  await requireOffice();
  const [c] = await db.delete(contracts).where(eq(contracts.id, id)).returning();
  refresh();
  return { ok: true, redirect: c ? `/office/jobs/${c.jobId}/documents` : "/office/jobs" };
}
