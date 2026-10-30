import "server-only";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  activity,
  bills,
  contacts,
  contracts,
  jobs,
  labourBookings,
  labourEntries,
  stages,
  users,
  variations,
} from "@/db/schema";
import type { ContactType } from "./constants";
import { getSetting } from "./settings";

export async function activeUsers() {
  return db
    .select({ id: users.id, name: users.name, role: users.role, phone: users.phone, email: users.email })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(asc(users.name));
}

export async function contactOptions(types?: ContactType[]) {
  return db
    .select({ id: contacts.id, name: contacts.name, type: contacts.type, trade: contacts.trade })
    .from(contacts)
    .where(and(eq(contacts.archived, false), types ? inArray(contacts.type, types) : undefined))
    .orderBy(asc(contacts.name));
}

export async function jobOptions(statuses?: string[]) {
  return db
    .select({ id: jobs.id, name: jobs.name, status: jobs.status })
    .from(jobs)
    .where(statuses ? inArray(jobs.status, statuses) : ne(jobs.status, "lost"))
    .orderBy(desc(jobs.updatedAt));
}

export async function getJob(id: number) {
  if (!Number.isFinite(id)) notFound();
  const [row] = await db
    .select({ job: jobs, client: contacts, supervisor: { id: users.id, name: users.name, phone: users.phone } })
    .from(jobs)
    .leftJoin(contacts, eq(contacts.id, jobs.clientId))
    .leftJoin(users, eq(users.id, jobs.supervisorId))
    .where(eq(jobs.id, id));
  if (!row) notFound();
  return { ...row.job, client: row.client, supervisor: row.supervisor?.id ? row.supervisor : null };
}

export async function jobStages(jobId: number) {
  const rows = await db
    .select({ stage: stages, contact: { id: contacts.id, name: contacts.name, phone: contacts.phone, email: contacts.email } })
    .from(stages)
    .leftJoin(contacts, eq(contacts.id, stages.contactId))
    .where(eq(stages.jobId, jobId))
    .orderBy(asc(stages.sortOrder), asc(stages.id));
  return rows.map((r) => ({ ...r.stage, contact: r.contact?.id ? r.contact : null }));
}

export async function jobActivity(jobId: number, limit = 100) {
  return db
    .select({ a: activity, user: users.name })
    .from(activity)
    .leftJoin(users, eq(users.id, activity.userId))
    .where(eq(activity.jobId, jobId))
    .orderBy(desc(activity.createdAt))
    .limit(limit);
}

export type StageFinance = {
  id: number;
  name: string;
  budget: number;
  committed: number;
  actual: number;
  pending: number;
};

/**
 * Job costs and margin. All amounts in cents, ex GST.
 *  Revenue   = contract value + approved variations
 *  Budget    = stage cost budgets (from the accepted quote) + approved variation costs
 *  Committed = subcontract agreements (sent or signed)
 *  Actual    = approved/paid invoices + SDL supervisor hours × hourly rate
 *  Forecast  = for each stage the larger of budget / committed / actual, + variation costs + unallocated actuals
 */
export async function jobFinance(jobId: number) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) throw new Error("Job not found");
  const [stageRows, vars, billRows, subcontracts, sdlLabour, kprLabour, bookings, rates] = await Promise.all([
    db.select().from(stages).where(eq(stages.jobId, jobId)).orderBy(asc(stages.sortOrder)),
    db.select().from(variations).where(eq(variations.jobId, jobId)),
    db.select().from(bills).where(eq(bills.jobId, jobId)),
    db
      .select()
      .from(contracts)
      .where(and(eq(contracts.jobId, jobId), eq(contracts.kind, "subcontract"), inArray(contracts.status, ["sent", "signed"]))),
    db
      .select({
        hours: labourEntries.hours,
        rate: users.hourlyRateCents,
        stageId: sql<number | null>`(select stage_id from daily_logs where daily_logs.id = ${labourEntries.dailyLogId})`,
      })
      .from(labourEntries)
      .leftJoin(users, eq(users.id, labourEntries.userId))
      .where(and(eq(labourEntries.jobId, jobId), eq(labourEntries.kind, "sdl"))),
    db
      .select({ hours: sql<number>`coalesce(sum(${labourEntries.hours}), 0)` })
      .from(labourEntries)
      .where(and(eq(labourEntries.jobId, jobId), eq(labourEntries.kind, "kpr"))),
    db.select().from(labourBookings).where(and(eq(labourBookings.jobId, jobId), ne(labourBookings.status, "cancelled"))),
    getSetting("rates"),
  ]);

  const approvedVars = vars.filter((v) => v.status === "approved" || v.status === "invoiced");
  const variationRevenue = approvedVars.reduce((s, v) => s + v.priceCents, 0);
  const variationCost = approvedVars.reduce((s, v) => s + v.costCents, 0);
  const pendingVariations = vars.filter((v) => ["identified", "priced", "submitted"].includes(v.status));

  const spent = billRows.filter((b) => b.status === "approved" || b.status === "paid");
  const pending = billRows.filter((b) => b.status === "pending");

  const stageMap = new Map<number, StageFinance>();
  for (const s of stageRows) stageMap.set(s.id, { id: s.id, name: s.name, budget: s.budgetCents, committed: 0, actual: 0, pending: 0 });
  let unallocatedActual = 0;

  for (const c of subcontracts) {
    const st = c.stageId ? stageMap.get(c.stageId) : undefined;
    if (st) st.committed += c.amountCents;
  }
  for (const b of spent) {
    const st = b.stageId ? stageMap.get(b.stageId) : undefined;
    if (st) st.actual += b.amountCents;
    else unallocatedActual += b.amountCents;
  }
  for (const b of pending) {
    const st = b.stageId ? stageMap.get(b.stageId) : undefined;
    if (st) st.pending += b.amountCents;
  }
  let sdlHours = 0;
  let sdlCost = 0;
  for (const l of sdlLabour) {
    const cost = Math.round(l.hours * (l.rate ?? 0));
    sdlHours += l.hours;
    sdlCost += cost;
    const st = l.stageId ? stageMap.get(l.stageId) : undefined;
    if (st) st.actual += cost;
    else unallocatedActual += cost;
  }

  const stageList = [...stageMap.values()];
  const budget = stageList.reduce((s, x) => s + x.budget, 0) + variationCost;
  const committed = stageList.reduce((s, x) => s + x.committed, 0);
  const actual = stageList.reduce((s, x) => s + x.actual, 0) + unallocatedActual;
  const forecastCost =
    stageList.reduce((s, x) => s + Math.max(x.budget, x.committed, x.actual), 0) + variationCost + unallocatedActual;
  const revenue = job.contractValueCents + variationRevenue;
  const forecastMargin = revenue - forecastCost;

  const kprHoursLogged = Number(kprLabour[0]?.hours ?? 0);
  const kprBilled = billRows.filter((b) => b.kind === "labour_hire" && b.status !== "rejected");
  const kprHoursBilled = kprBilled.reduce((s, b) => s + (b.hours ?? 0), 0);
  const kprHoursBooked = bookings.reduce((s, b) => s + b.workers * b.hours * b.days, 0);

  return {
    contract: job.contractValueCents,
    variationRevenue,
    variationCost,
    pendingVariationValue: pendingVariations.reduce((s, v) => s + v.priceCents, 0),
    pendingVariationCount: pendingVariations.length,
    revenue,
    budget,
    committed,
    actual,
    pendingBills: pending.reduce((s, b) => s + b.amountCents, 0),
    forecastCost,
    forecastMargin,
    forecastMarginPct: revenue ? (forecastMargin / revenue) * 100 : 0,
    budgetMarginPct: revenue ? ((revenue - budget) / revenue) * 100 : 0,
    sdlHours,
    sdlCost,
    kprHoursLogged,
    kprHoursBilled,
    kprHoursBooked,
    kprRateCents: rates.kprHourlyCents,
    stages: stageList,
    unallocatedActual,
  };
}
export type JobFinance = Awaited<ReturnType<typeof jobFinance>>;
