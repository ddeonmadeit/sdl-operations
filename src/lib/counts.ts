import "server-only";
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bills, labourBookings, stages, tasks, variations } from "@/db/schema";

export async function navCounts(userId: number) {
  const [[b], [s], [k], [t], [v]] = await Promise.all([
    db.select({ n: count() }).from(bills).where(eq(bills.status, "pending")),
    db.select({ n: count() }).from(stages).where(eq(stages.status, "complete")),
    db.select({ n: count() }).from(labourBookings).where(eq(labourBookings.status, "requested")),
    db.select({ n: count() }).from(tasks).where(and(eq(tasks.status, "open"), eq(tasks.assigneeId, userId))),
    db.select({ n: count() }).from(variations).where(inArray(variations.status, ["identified"])),
  ]);
  return {
    approvals: (b?.n ?? 0) + (s?.n ?? 0) + (k?.n ?? 0),
    tasks: t?.n ?? 0,
    variations: v?.n ?? 0,
  };
}
