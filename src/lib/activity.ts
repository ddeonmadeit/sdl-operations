import "server-only";
import { db } from "@/db";
import { activity } from "@/db/schema";

export async function logActivity(opts: { jobId?: number | null; userId?: number | null; kind: string; message: string }) {
  await db.insert(activity).values({
    jobId: opts.jobId ?? null,
    userId: opts.userId ?? null,
    kind: opts.kind,
    message: opts.message,
  });
}
