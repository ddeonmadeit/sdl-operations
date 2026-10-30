import "server-only";
import { db } from "@/db";
import { inductions } from "@/db/schema";
import { refresh } from "@/lib/actions/util";
import { logActivity } from "@/lib/activity";
import { optStr, str, type ActionState } from "@/lib/form";
import { getSetting } from "@/lib/settings";

/** Shared by the supervisor's phone (createInduction) and the worker's own phone (public QR link). */
export async function recordInduction(jobId: number, fd: FormData, selfSigned = false, userId?: number): Promise<ActionState> {
  const name = str(fd, "name");
  if (!name) return { error: "Enter the worker's full name." };
  const signature = str(fd, "signature");
  if (!signature.startsWith("data:image/png;base64,") || signature.length < 1500) return { error: "A signature is required." };
  if (signature.length > 600_000) return { error: "Signature image is too large – please clear and sign again." };
  const { inductionItems } = await getSetting("templates");
  const answers = fd.getAll("answers").map(String);
  if (inductionItems.some((item) => !answers.includes(item))) return { error: "Every induction item must be ticked." };

  await db.insert(inductions).values({
    jobId,
    name,
    company: optStr(fd, "company"),
    phone: optStr(fd, "phone"),
    whiteCard: optStr(fd, "whiteCard"),
    emergencyContact: optStr(fd, "emergencyContact"),
    answers,
    signatureData: signature,
    inductedById: userId ?? null,
    selfSigned,
  });
  await logActivity({
    jobId,
    userId,
    kind: "induction",
    message: `Site induction signed: ${name}${str(fd, "company") ? ` (${str(fd, "company")})` : ""}${selfSigned ? " – own phone" : ""}`,
  });
  refresh();
  return { ok: true, message: `${name} inducted` };
}
