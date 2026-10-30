"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, quoteItems, quotes } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { randomToken, requireOffice } from "@/lib/auth";
import { addDays, today } from "@/lib/format";
import { optDate, optStr, str, type ActionState } from "@/lib/form";
import { getSetting } from "@/lib/settings";
import { applyAcceptedQuote } from "@/lib/quote-accept";
import { refresh } from "./util";

type Result = ActionState & { redirect?: string };

export async function createQuote(jobId: number, fd: FormData): Promise<Result> {
  const user = await requireOffice();
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) return { error: "Job not found." };
  const [rates, templates] = await Promise.all([getSetting("rates"), getSetting("templates")]);
  const kind = str(fd, "kind") === "estimate" ? "estimate" : "quote";

  // Copy items from another quote (e.g. turning an estimate into a quote)
  const copyFrom = Number(fd.get("copyFrom")) || null;
  const [q] = await db
    .insert(quotes)
    .values({
      jobId,
      kind,
      title: str(fd, "title") || `${kind === "estimate" ? "Estimate" : "Quote"} – ${job.name}`,
      markupPct: rates.defaultMarkupPct,
      notes: templates.quoteTerms,
      validUntil: addDays(today(), rates.quoteValidDays),
      createdById: user.id,
      shareToken: `q_${randomToken(18)}`,
    })
    .returning({ id: quotes.id });

  if (copyFrom) {
    const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, copyFrom));
    if (items.length)
      await db.insert(quoteItems).values(items.map(({ id: _id, quoteId: _q, ...rest }) => ({ ...rest, quoteId: q!.id })));
  }
  if (["enquiry", "site_visit"].includes(job.status)) {
    await db.update(jobs).set({ status: "quoting", updatedAt: new Date() }).where(eq(jobs.id, jobId));
  }
  await logActivity({ jobId, userId: user.id, kind: "quote", message: `${kind === "estimate" ? "Estimate" : "Quote"} Q${q!.id} started` });
  refresh();
  return { ok: true, redirect: `/office/quotes/${q!.id}` };
}

type ItemInput = { section: string; description: string; qty: number; unit: string; unitCostCents: number; unitPriceCents: number };

export async function saveQuote(quoteId: number, fd: FormData): Promise<Result> {
  await requireOffice();
  let items: ItemInput[];
  try {
    items = JSON.parse(str(fd, "items") || "[]");
  } catch {
    return { error: "Couldn't read the line items." };
  }
  const clean = items
    .filter((i) => i.description?.trim())
    .map((i, idx) => ({
      quoteId,
      section: String(i.section || "").slice(0, 200),
      description: i.description.trim(),
      qty: Number(i.qty) || 0,
      unit: String(i.unit || "item").slice(0, 20),
      unitCostCents: Math.round(Number(i.unitCostCents) || 0),
      unitPriceCents: Math.round(Number(i.unitPriceCents) || 0),
      sortOrder: idx,
    }));

  await db.transaction(async (tx) => {
    await tx
      .update(quotes)
      .set({
        title: str(fd, "title") || "Quote",
        kind: str(fd, "kind") === "estimate" ? "estimate" : "quote",
        notes: optStr(fd, "notes"),
        validUntil: optDate(fd, "validUntil"),
        markupPct: Number(str(fd, "markupPct")) || 0,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, quoteId));
    await tx.delete(quoteItems).where(eq(quoteItems.quoteId, quoteId));
    if (clean.length) await tx.insert(quoteItems).values(clean);
  });
  refresh();
  return { ok: true, message: "Quote saved" };
}

export async function setQuoteStatus(quoteId: number, status: "draft" | "sent" | "accepted" | "declined"): Promise<Result> {
  const user = await requireOffice();
  if (status === "accepted") {
    await applyAcceptedQuote(quoteId, { userId: user.id });
  } else {
    const [q] = await db
      .update(quotes)
      .set({ status, sentAt: status === "sent" ? new Date() : undefined, updatedAt: new Date() })
      .where(eq(quotes.id, quoteId))
      .returning();
    if (q && status === "sent") {
      await db.update(jobs).set({ status: "quoted", updatedAt: new Date() }).where(eq(jobs.id, q.jobId));
    }
    if (q) await logActivity({ jobId: q.jobId, userId: user.id, kind: "quote", message: `Quote Q${q.id} marked ${status}` });
  }
  refresh();
  return { ok: true };
}

export async function deleteQuote(quoteId: number): Promise<Result> {
  await requireOffice();
  const [q] = await db.delete(quotes).where(eq(quotes.id, quoteId)).returning();
  refresh();
  return { ok: true, redirect: q ? `/office/jobs/${q.jobId}/quotes` : "/office/jobs" };
}
