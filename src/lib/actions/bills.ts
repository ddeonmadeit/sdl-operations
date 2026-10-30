"use server";

import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { bills, contacts, files, labourEntries, users } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { requireOffice } from "@/lib/auth";
import { BILL_KINDS, type BillKind } from "@/lib/constants";
import { addDays, fmtDate, money } from "@/lib/format";
import { cents, int, num, optDate, optStr, str, type ActionState } from "@/lib/form";
import { getSetting, getXeroConnection } from "@/lib/settings";
import { pushBill, syncBillPayments, xeroConfigured } from "@/lib/xero";
import { refresh } from "./util";

export async function createBill(fd: FormData): Promise<ActionState> {
  const user = await requireOffice();
  const jobId = int(fd, "jobId");
  const contactId = int(fd, "contactId");
  if (!jobId) return { error: "Choose the job this invoice is for." };
  if (!contactId) return { error: "Choose who sent the invoice." };
  const amountCents = cents(fd, "amount");
  if (amountCents <= 0) return { error: "Enter the invoice amount (ex GST)." };
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId));
  const kind: BillKind =
    (str(fd, "kind") as BillKind) in BILL_KINDS
      ? (str(fd, "kind") as BillKind)
      : contact?.type === "labour_hire"
        ? "labour_hire"
        : contact?.type === "subcontractor"
          ? "subcontractor"
          : "supplier";
  const { gstPct } = await getSetting("rates");
  const gstInput = str(fd, "gst");
  const gstCents = gstInput === "" ? Math.round((amountCents * gstPct) / 100) : cents(fd, "gst");

  const [bill] = await db
    .insert(bills)
    .values({
      jobId,
      contactId,
      kind,
      stageId: int(fd, "stageId"),
      reference: optStr(fd, "reference"),
      description: optStr(fd, "description"),
      invoiceDate: optDate(fd, "invoiceDate"),
      dueDate: optDate(fd, "dueDate"),
      periodFrom: optDate(fd, "periodFrom"),
      periodTo: optDate(fd, "periodTo"),
      hours: num(fd, "hours"),
      amountCents,
      gstCents,
      createdById: user.id,
    })
    .returning();

  const ids = fd.getAll("fileIds").map(Number).filter(Boolean);
  if (ids.length)
    await db
      .update(files)
      .set({ ownerType: "bill", ownerId: bill!.id, jobId, category: "invoice" })
      .where(and(inArray(files.id, ids), eq(files.ownerType, "pending")));

  await logActivity({ jobId, userId: user.id, kind: "bill", message: `Invoice from ${contact?.name ?? "supplier"} for ${money(amountCents)} added for checking` });
  refresh();
  return { ok: true, message: "Invoice added to the approval queue" };
}

export async function approveBill(id: number, fd: FormData): Promise<ActionState> {
  const user = await requireOffice();
  const [bill] = await db.select().from(bills).where(eq(bills.id, id));
  if (!bill) return { error: "Not found." };
  await db
    .update(bills)
    .set({ status: "approved", approvedAt: new Date(), approvedById: user.id, reviewNote: optStr(fd, "reviewNote") })
    .where(eq(bills.id, id));

  let pushed = false;
  if (str(fd, "toXero") === "on" && xeroConfigured() && (await getXeroConnection())) {
    try {
      await pushBill(id);
      pushed = true;
    } catch (err) {
      console.error(err);
      refresh();
      return { error: `Approved, but Xero said: ${(err as Error).message}` };
    }
  }
  await logActivity({ jobId: bill.jobId, userId: user.id, kind: "bill", message: `Approved for payment: ${money(bill.amountCents)}${bill.reference ? ` (${bill.reference})` : ""}${pushed ? " – sent to Xero" : ""}` });
  refresh();
  return { ok: true, message: pushed ? "Approved and sent to Xero" : "Approved for payment" };
}

export async function rejectBill(id: number, fd: FormData): Promise<ActionState> {
  const user = await requireOffice();
  const note = optStr(fd, "reviewNote");
  if (!note) return { error: "Add a short reason so the supplier can be told what's wrong." };
  const [bill] = await db.update(bills).set({ status: "rejected", reviewNote: note }).where(eq(bills.id, id)).returning();
  if (bill) await logActivity({ jobId: bill.jobId, userId: user.id, kind: "bill", message: `Invoice ${bill.reference ?? ""} queried/rejected: ${note}` });
  refresh();
  return { ok: true, message: "Marked as rejected" };
}

export async function setBillStatus(id: number, status: "pending" | "paid"): Promise<ActionState> {
  await requireOffice();
  await db
    .update(bills)
    .set({ status, paidAt: status === "paid" ? new Date() : null, ...(status === "pending" ? { approvedAt: null, approvedById: null } : {}) })
    .where(eq(bills.id, id));
  refresh();
  return { ok: true, message: status === "paid" ? "Marked as paid" : "Moved back to checking" };
}

export async function sendBillToXero(id: number): Promise<ActionState> {
  await requireOffice();
  try {
    await pushBill(id);
  } catch (err) {
    return { error: `Xero: ${(err as Error).message}` };
  }
  refresh();
  return { ok: true, message: "Sent to Xero" };
}

export async function deleteBill(id: number): Promise<ActionState> {
  await requireOffice();
  await db.delete(bills).where(eq(bills.id, id));
  refresh();
  return { ok: true, message: "Invoice deleted" };
}

export async function syncXero(): Promise<ActionState> {
  await requireOffice();
  try {
    const n = await syncBillPayments();
    refresh();
    return { ok: true, message: n ? `${n} bill${n > 1 ? "s" : ""} marked paid from Xero` : "Up to date with Xero" };
  } catch (err) {
    return { error: `Xero: ${(err as Error).message}` };
  }
}

/** Approve a supervisor's SDL hours for a week (Mon–Sun). */
export async function approveTimesheet(userId: number, weekStart: string): Promise<ActionState> {
  const user = await requireOffice();
  const weekEnd = addDays(weekStart, 6);
  const rows = await db
    .update(labourEntries)
    .set({ approvedAt: new Date(), approvedById: user.id })
    .where(
      and(
        eq(labourEntries.kind, "sdl"),
        eq(labourEntries.userId, userId),
        gte(labourEntries.date, weekStart),
        lte(labourEntries.date, weekEnd),
        isNull(labourEntries.approvedAt),
      ),
    )
    .returning({ hours: labourEntries.hours });
  const [sup] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  const total = rows.reduce((s, r) => s + r.hours, 0);
  await logActivity({ userId: user.id, kind: "timesheet", message: `Approved ${total}h for ${sup?.name ?? "supervisor"} (week of ${fmtDate(weekStart)})` });
  refresh();
  return { ok: true, message: `Approved ${total} hours` };
}
