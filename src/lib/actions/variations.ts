"use server";

import { and, eq, inArray, max } from "drizzle-orm";
import { db } from "@/db";
import { files, variations } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { randomToken, requireOffice, requireUser } from "@/lib/auth";
import { VARIATION_STATUSES, type VariationStatus } from "@/lib/constants";
import { money } from "@/lib/format";
import { cents, optStr, str, type ActionState } from "@/lib/form";
import { pushVariationInvoice, xeroConfigured } from "@/lib/xero";
import { getXeroConnection } from "@/lib/settings";
import { refresh } from "./util";

type Result = ActionState & { redirect?: string };

export async function createVariation(jobId: number, fd: FormData): Promise<Result> {
  const user = await requireUser();
  const title = str(fd, "title");
  if (!title) return { error: "Give the variation a short title." };
  const office = user.role !== "supervisor";
  const priceCents = office ? cents(fd, "price") : 0;
  const costCents = office ? cents(fd, "cost") : 0;
  const [m] = await db.select({ m: max(variations.number) }).from(variations).where(eq(variations.jobId, jobId));
  const [v] = await db
    .insert(variations)
    .values({
      jobId,
      number: (m?.m ?? 0) + 1,
      title,
      description: optStr(fd, "description"),
      source: str(fd, "source") || (office ? "office" : "site"),
      status: priceCents ? "priced" : "identified",
      priceCents,
      costCents,
      pricedAt: priceCents ? new Date() : null,
      identifiedById: user.id,
      shareToken: `v_${randomToken(18)}`,
    })
    .returning();

  const ids = fd.getAll("fileIds").map(Number).filter(Boolean);
  if (ids.length)
    await db
      .update(files)
      .set({ ownerType: "variation", ownerId: v!.id, jobId })
      .where(and(inArray(files.id, ids), eq(files.ownerType, "pending")));

  await logActivity({ jobId, userId: user.id, kind: "variation", message: `Variation V${v!.number} identified: ${title}` });
  refresh();
  return { ok: true, message: `Variation V${v!.number} logged – the office will price it` };
}

export async function updateVariation(id: number, fd: FormData): Promise<Result> {
  const user = await requireOffice();
  const [v] = await db.select().from(variations).where(eq(variations.id, id));
  if (!v) return { error: "Not found." };
  const priceCents = cents(fd, "price");
  const costCents = cents(fd, "cost");
  const nowPriced = v.status === "identified" && priceCents > 0;
  await db
    .update(variations)
    .set({
      title: str(fd, "title") || v.title,
      description: optStr(fd, "description"),
      priceCents,
      costCents,
      status: nowPriced ? "priced" : v.status,
      pricedAt: nowPriced ? new Date() : v.pricedAt,
    })
    .where(eq(variations.id, id));
  if (nowPriced) {
    await logActivity({ jobId: v.jobId, userId: user.id, kind: "variation", message: `Variation V${v.number} priced at ${money(priceCents)}` });
  }
  refresh();
  return { ok: true, message: nowPriced ? "Variation priced" : "Variation saved" };
}

export async function setVariationStatus(id: number, status: VariationStatus): Promise<Result> {
  const user = await requireOffice();
  if (!(status in VARIATION_STATUSES)) return { error: "Unknown status." };
  const [v] = await db.select().from(variations).where(eq(variations.id, id));
  if (!v) return { error: "Not found." };
  if (status === "approved" && !v.priceCents) return { error: "Price the variation before approving it." };
  const now = new Date();
  await db
    .update(variations)
    .set({
      status,
      approvedAt: status === "approved" ? (v.approvedAt ?? now) : status === "invoiced" ? v.approvedAt : null,
      approvedName: status === "approved" ? (v.approvedName ?? `Recorded by ${user.name}`) : status === "invoiced" ? v.approvedName : null,
      declinedAt: status === "declined" ? now : null,
      submittedAt: status === "submitted" ? (v.submittedAt ?? now) : v.submittedAt,
    })
    .where(eq(variations.id, id));
  await logActivity({
    jobId: v.jobId,
    userId: user.id,
    kind: "variation",
    message: `Variation V${v.number} → ${VARIATION_STATUSES[status].label}`,
  });
  refresh();
  return { ok: true };
}

/** Records the client invoice for an approved variation – in Xero if connected, or with a manual invoice number. */
export async function invoiceVariation(id: number, fd: FormData): Promise<Result> {
  const user = await requireOffice();
  const [v] = await db.select().from(variations).where(eq(variations.id, id));
  if (!v) return { error: "Not found." };
  if (v.status !== "approved") return { error: "Only approved variations can be invoiced." };

  let invoiceRef = optStr(fd, "invoiceRef");
  let xeroInvoiceId: string | null = null;
  if (str(fd, "mode") === "xero") {
    if (!xeroConfigured() || !(await getXeroConnection())) return { error: "Xero isn't connected. Connect it in Settings." };
    try {
      const res = await pushVariationInvoice(v.id);
      xeroInvoiceId = res.invoiceId;
      invoiceRef = res.invoiceNumber ?? invoiceRef;
    } catch (err) {
      console.error(err);
      return { error: `Xero: ${(err as Error).message}` };
    }
  }
  await db
    .update(variations)
    .set({ status: "invoiced", invoicedAt: new Date(), invoiceRef, xeroInvoiceId })
    .where(eq(variations.id, id));
  await logActivity({
    jobId: v.jobId,
    userId: user.id,
    kind: "variation",
    message: `Variation V${v.number} invoiced${invoiceRef ? ` (${invoiceRef})` : ""}${xeroInvoiceId ? " in Xero" : ""}`,
  });
  refresh();
  return { ok: true, message: xeroInvoiceId ? "Draft invoice created in Xero" : "Marked as invoiced" };
}

export async function deleteVariation(id: number): Promise<Result> {
  await requireOffice();
  await db.delete(variations).where(eq(variations.id, id));
  refresh();
  return { ok: true, message: "Variation deleted" };
}
