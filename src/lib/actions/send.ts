"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contracts, jobs, labourBookings, quotes, variations } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { requireOffice } from "@/lib/auth";
import { emailEnabled, sendEmail } from "@/lib/email";
import { str, type ActionState } from "@/lib/form";
import type { DocKind } from "@/lib/messages";
import { refresh } from "./util";

/**
 * Sends (or records as sent) a quote, contract/agreement, variation or KPR booking order.
 * mode=email sends via SMTP; mode=manual just records it (the user copied the link or used their own email app).
 */
export async function sendDoc(kind: DocKind, id: number, fd: FormData): Promise<ActionState> {
  const user = await requireOffice();
  const mode = str(fd, "mode");
  const to = str(fd, "to");
  let emailed = false;

  if (mode === "email") {
    if (!emailEnabled()) return { error: "Email isn't set up yet – use “Open in email app” or copy the link." };
    if (!to || !to.includes("@")) return { error: "Enter an email address." };
    try {
      emailed = await sendEmail({ to, subject: str(fd, "subject"), text: str(fd, "body") });
    } catch (err) {
      console.error(err);
      return { error: "The email couldn't be sent. Check the SMTP settings." };
    }
  }

  const now = new Date();
  let jobId: number | undefined;
  let label = "";

  if (kind === "quote") {
    const [q] = await db.update(quotes).set({ status: "sent", sentAt: now, updatedAt: now }).where(eq(quotes.id, id)).returning();
    if (q) {
      jobId = q.jobId;
      label = `Quote Q${q.id}`;
      const [job] = await db.select().from(jobs).where(eq(jobs.id, q.jobId));
      if (job && ["enquiry", "site_visit", "quoting"].includes(job.status)) {
        await db.update(jobs).set({ status: "quoted", updatedAt: now }).where(eq(jobs.id, q.jobId));
      }
    }
  } else if (kind === "contract") {
    const [c] = await db.update(contracts).set({ status: "sent", sentAt: now }).where(eq(contracts.id, id)).returning();
    if (c) {
      jobId = c.jobId;
      label = c.title;
    }
  } else if (kind === "variation") {
    const [v] = await db.update(variations).set({ status: "submitted", submittedAt: now }).where(eq(variations.id, id)).returning();
    if (v) {
      jobId = v.jobId;
      label = `Variation V${v.number}`;
    }
  } else if (kind === "booking") {
    const [b] = await db
      .update(labourBookings)
      .set({ status: "booked", bookedAt: now, bookedById: user.id })
      .where(eq(labourBookings.id, id))
      .returning();
    if (b) {
      jobId = b.jobId;
      label = `KPR booking PO-${b.id}`;
    }
  }

  await logActivity({
    jobId,
    userId: user.id,
    kind,
    message: kind === "booking" ? `${label} confirmed${emailed ? ` – order emailed to ${to}` : ""}` : `${label} sent${emailed ? ` to ${to}` : ""}`,
  });
  refresh();
  return { ok: true, message: emailed ? `Emailed to ${to}` : kind === "booking" ? "Marked as booked" : "Marked as sent" };
}
