"use server";

import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, labourBookings } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { requireOffice, requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { int, num, optDate, optStr, str, type ActionState } from "@/lib/form";
import { refresh } from "./util";

async function defaultLabourHire() {
  const [kpr] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.type, "labour_hire"))
    .orderBy(asc(contacts.id))
    .limit(1);
  return kpr?.id ?? null;
}

/** Site (or office) requests KPR labour. The office then books it with KPR. */
export async function requestBooking(jobId: number, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const date = optDate(fd, "date");
  if (!date) return { error: "Choose a date." };
  const workers = Math.max(1, int(fd, "workers") ?? 1);
  const days = Math.max(1, int(fd, "days") ?? 1);
  await db.insert(labourBookings).values({
    jobId,
    contactId: int(fd, "contactId") ?? (await defaultLabourHire()),
    stageId: int(fd, "stageId"),
    date,
    days,
    workers,
    hours: num(fd, "hours") ?? 8,
    startTime: str(fd, "startTime") || "07:00",
    task: optStr(fd, "task"),
    requestedById: user.id,
  });
  await logActivity({
    jobId,
    userId: user.id,
    kind: "booking",
    message: `KPR labour requested: ${workers} worker${workers > 1 ? "s" : ""} from ${fmtDate(date, { weekday: true })}${days > 1 ? ` for ${days} days` : ""}`,
  });
  refresh();
  return { ok: true, message: "Request sent to the office" };
}

export async function updateBooking(id: number, fd: FormData): Promise<ActionState> {
  await requireOffice();
  const date = optDate(fd, "date");
  if (!date) return { error: "Choose a date." };
  await db
    .update(labourBookings)
    .set({
      date,
      days: Math.max(1, int(fd, "days") ?? 1),
      workers: Math.max(1, int(fd, "workers") ?? 1),
      hours: num(fd, "hours") ?? 8,
      startTime: str(fd, "startTime") || "07:00",
      task: optStr(fd, "task"),
      stageId: int(fd, "stageId"),
    })
    .where(eq(labourBookings.id, id));
  refresh();
  return { ok: true, message: "Booking updated" };
}

export async function cancelBooking(id: number): Promise<ActionState> {
  const user = await requireUser();
  const [b] = await db.update(labourBookings).set({ status: "cancelled" }).where(eq(labourBookings.id, id)).returning();
  if (b) await logActivity({ jobId: b.jobId, userId: user.id, kind: "booking", message: `KPR booking PO-${b.id} cancelled` });
  refresh();
  return { ok: true, message: "Booking cancelled" };
}
