"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contracts, jobs, quotes, variations } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { str, type ActionState } from "@/lib/form";
import { recordInduction } from "@/lib/induction";
import { applyAcceptedQuote } from "@/lib/quote-accept";
import { refresh } from "./util";

/**
 * Public (no login) actions used by the links we send to clients, subcontractors and workers.
 * Access is controlled by the unguessable token in the link.
 */

function readSignature(fd: FormData) {
  const name = str(fd, "name");
  const signature = str(fd, "signature");
  if (!name) return { error: "Please type your full name." };
  if (!signature.startsWith("data:image/png;base64,") || signature.length < 1500) return { error: "Please sign in the box." };
  if (signature.length > 600_000) return { error: "Signature is too large – clear it and sign again." };
  if (fd.get("agree") !== "on") return { error: "Please tick the box to confirm." };
  return { name, signature };
}

export async function signDocument(token: string, fd: FormData): Promise<ActionState> {
  const sig = readSignature(fd);
  if ("error" in sig) return sig;

  if (token.startsWith("q_")) {
    const [q] = await db.select().from(quotes).where(eq(quotes.shareToken, token));
    if (!q || q.kind !== "quote") return { error: "This link is no longer valid." };
    if (q.status === "accepted") return { ok: true, message: "Already accepted – thank you." };
    if (q.status === "declined") return { error: "This quote was declined. Please contact us." };
    await applyAcceptedQuote(q.id, { acceptedName: sig.name, signatureData: sig.signature });
  } else if (token.startsWith("c_")) {
    const [c] = await db.select().from(contracts).where(eq(contracts.shareToken, token));
    if (!c || c.status === "cancelled" || c.status === "draft") return { error: "This link is no longer valid." };
    if (c.status === "signed") return { ok: true, message: "Already signed – thank you." };
    await db
      .update(contracts)
      .set({ status: "signed", signedAt: new Date(), signedName: sig.name, signatureData: sig.signature })
      .where(eq(contracts.id, c.id));
    if (c.kind === "client") {
      await db.update(jobs).set({ contractValueCents: c.amountCents, updatedAt: new Date() }).where(eq(jobs.id, c.jobId));
    }
    await logActivity({ jobId: c.jobId, kind: "contract", message: `${c.title} signed online by ${sig.name}` });
  } else if (token.startsWith("v_")) {
    const [v] = await db.select().from(variations).where(eq(variations.shareToken, token));
    if (!v || v.status !== "submitted") {
      if (v?.status === "approved" || v?.status === "invoiced") return { ok: true, message: "Already approved – thank you." };
      return { error: "This link is no longer valid." };
    }
    await db
      .update(variations)
      .set({ status: "approved", approvedAt: new Date(), approvedName: sig.name, signatureData: sig.signature })
      .where(eq(variations.id, v.id));
    await logActivity({ jobId: v.jobId, kind: "variation", message: `Variation V${v.number} approved online by ${sig.name}` });
  } else {
    return { error: "This link is no longer valid." };
  }
  refresh();
  return { ok: true, message: "Signed – thank you!" };
}

export async function declineDocument(token: string, fd: FormData): Promise<ActionState> {
  const reason = str(fd, "reason");
  if (token.startsWith("q_")) {
    const [q] = await db.select().from(quotes).where(eq(quotes.shareToken, token));
    if (!q || q.status !== "sent") return { error: "This quote can't be declined online." };
    await db.update(quotes).set({ status: "declined", updatedAt: new Date() }).where(eq(quotes.id, q.id));
    await logActivity({ jobId: q.jobId, kind: "quote", message: `Quote Q${q.id} declined by client${reason ? `: ${reason}` : ""}` });
  } else if (token.startsWith("v_")) {
    const [v] = await db.select().from(variations).where(eq(variations.shareToken, token));
    if (!v || v.status !== "submitted") return { error: "This variation can't be declined online." };
    await db.update(variations).set({ status: "declined", declinedAt: new Date() }).where(eq(variations.id, v.id));
    await logActivity({ jobId: v.jobId, kind: "variation", message: `Variation V${v.number} declined by client${reason ? `: ${reason}` : ""}` });
  } else {
    return { error: "This can't be declined online." };
  }
  refresh();
  return { ok: true, message: "Thanks – we've let the office know." };
}

export async function selfInduct(token: string, fd: FormData): Promise<ActionState> {
  if (!token) return { error: "This induction link is no longer valid." };
  const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.inductionToken, token));
  if (!job) return { error: "This induction link is no longer valid. Ask the supervisor for a new one." };
  return recordInduction(job.id, fd, true);
}
