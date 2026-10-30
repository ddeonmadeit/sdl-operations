import Link from "next/link";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { CheckCircle2, ChevronRight, HardHat, Plus, RefreshCw, Receipt } from "lucide-react";
import { ActionButton, ActionForm, Modal, SubmitButton } from "@/components/client";
import { BillFields } from "@/components/office/bill-fields";
import { SendDialog } from "@/components/send-dialog";
import { Avatar, Badge, Card, cx, EmptyState, PageHeader, StatusBadge, Tabs } from "@/components/ui";
import { db } from "@/db";
import { bills, contacts, jobs, labourBookings, labourEntries, stages, users } from "@/db/schema";
import { approveTimesheet, createBill, syncXero } from "@/lib/actions/bills";
import { setStageStatus } from "@/lib/actions/jobs";
import { sendDoc } from "@/lib/actions/send";
import { requireOffice } from "@/lib/auth";
import { BILL_KINDS, BILL_STATUSES } from "@/lib/constants";
import { emailEnabled } from "@/lib/email";
import { addDays, fmtDate, hours, money, timeAgo, today, weekStart } from "@/lib/format";
import { docMessage } from "@/lib/messages";
import { contactOptions, jobOptions } from "@/lib/queries";
import { getXeroConnection } from "@/lib/settings";
import { xeroConfigured } from "@/lib/xero";

export const metadata = { title: "Approvals" };

const TABS = {
  invoices: "Invoices",
  hours: "SDL hours",
  work: "Completed work",
  labour: "Labour requests",
  history: "History",
} as const;
type Tab = keyof typeof TABS;

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireOffice();
  const sp = await searchParams;
  const tab: Tab = sp.tab && sp.tab in TABS ? (sp.tab as Tab) : "invoices";

  const [pendingBills, completeStages, requests, unapprovedHours] = await Promise.all([
    db
      .select({ b: bills, contact: contacts.name, job: jobs.name, stage: stages.name, stageStatus: stages.status })
      .from(bills)
      .innerJoin(jobs, eq(jobs.id, bills.jobId))
      .leftJoin(contacts, eq(contacts.id, bills.contactId))
      .leftJoin(stages, eq(stages.id, bills.stageId))
      .where(eq(bills.status, "pending"))
      .orderBy(asc(bills.dueDate), asc(bills.createdAt)),
    db
      .select({ s: stages, job: jobs.name, contact: contacts.name })
      .from(stages)
      .innerJoin(jobs, eq(jobs.id, stages.jobId))
      .leftJoin(contacts, eq(contacts.id, stages.contactId))
      .where(eq(stages.status, "complete"))
      .orderBy(asc(stages.completedAt)),
    db
      .select({ b: labourBookings, job: jobs.name, by: users.name })
      .from(labourBookings)
      .innerJoin(jobs, eq(jobs.id, labourBookings.jobId))
      .leftJoin(users, eq(users.id, labourBookings.requestedById))
      .where(eq(labourBookings.status, "requested"))
      .orderBy(asc(labourBookings.date)),
    db
      .select({ l: labourEntries })
      .from(labourEntries)
      .where(and(eq(labourEntries.kind, "sdl"), gte(labourEntries.date, addDays(today(), -42))))
      .then((rows) => rows.filter((r) => !r.l.approvedAt)),
  ]);

  const hourWeeks = new Set(unapprovedHours.map((r) => `${r.l.userId}-${weekStart(r.l.date)}`)).size;
  const counts: Record<Tab, number> = {
    invoices: pendingBills.length,
    hours: hourWeeks,
    work: completeStages.length,
    labour: requests.length,
    history: 0,
  };

  return (
    <>
      <PageHeader
        title="Approvals"
        subtitle="Check work and hours before anything is paid"
        actions={<AddInvoiceButton />}
      />
      <Tabs
        current={`/office/approvals?tab=${tab}`}
        tabs={(Object.keys(TABS) as Tab[]).map((t) => ({ href: `/office/approvals?tab=${t}`, label: TABS[t], count: counts[t] }))}
      />

      {tab === "invoices" && <InvoicesTab rows={pendingBills} />}
      {tab === "hours" && <HoursTab />}
      {tab === "work" && (
        <Card pad={false}>
          {completeStages.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="size-5" />} title="Nothing waiting">Stages marked complete on site appear here for checking.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {completeStages.map(({ s, job, contact }) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/office/jobs/${s.jobId}/scope`} className="font-medium hover:underline">
                      {s.name} · {job}
                    </Link>
                    <div className="text-xs text-muted">
                      {contact ?? "SDL"} · marked complete {s.completedAt ? timeAgo(s.completedAt) : ""}
                    </div>
                  </div>
                  <Link href={`/office/jobs/${s.jobId}/diary`} className="btn btn-sm">
                    Photos & logs
                  </Link>
                  <ActionButton action={setStageStatus.bind(null, s.id, "signed_off")} className="btn-sm btn-primary" success="Signed off">
                    Sign off
                  </ActionButton>
                  <ActionButton action={setStageStatus.bind(null, s.id, "in_progress")} className="btn-sm btn-ghost" success="Sent back to in progress">
                    Not done
                  </ActionButton>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {tab === "labour" && <LabourTab rows={requests} />}
      {tab === "history" && <HistoryTab />}
    </>
  );
}

async function AddInvoiceButton() {
  const [jobList, people, stageRows] = await Promise.all([
    jobOptions(["won", "in_progress", "completed"]),
    contactOptions(["labour_hire", "subcontractor", "supplier"]),
    db.select({ id: stages.id, name: stages.name, jobId: stages.jobId }).from(stages).orderBy(asc(stages.sortOrder)),
  ]);
  return (
    <Modal title="Add invoice for checking" trigger={<><Plus className="size-4" /> Add invoice</>} triggerClassName="btn btn-primary">
      <ActionForm action={createBill} success="Invoice added">
        <BillFields jobs={jobList} stages={stageRows} contacts={people} />
        <SubmitButton className="btn-primary mt-4 w-full">Add invoice</SubmitButton>
      </ActionForm>
    </Modal>
  );
}

type PendingRow = {
  b: typeof bills.$inferSelect;
  contact: string | null;
  job: string;
  stage: string | null;
  stageStatus: string | null;
};

function InvoicesTab({ rows }: { rows: PendingRow[] }) {
  if (!rows.length)
    return (
      <div className="card">
        <EmptyState icon={<Receipt className="size-5" />} title="No invoices waiting">
          Add supplier, subcontractor and KPR invoices here to check them against the work and hours before paying.
        </EmptyState>
      </div>
    );
  const groups = (["labour_hire", "subcontractor", "supplier"] as const).map((k) => ({ k, items: rows.filter((r) => r.b.kind === k) }));
  return (
    <div className="space-y-5">
      {groups
        .filter((g) => g.items.length)
        .map((g) => (
          <Card key={g.k} title={`${BILL_KINDS[g.k]} · ${g.items.length}`} pad={false} action={<span className="text-sm font-semibold tabular-nums">{money(g.items.reduce((s, r) => s + r.b.amountCents, 0))}</span>}>
            <ul className="divide-y divide-line">
              {g.items.map(({ b, contact, job, stage, stageStatus }) => (
                <li key={b.id}>
                  <Link href={`/office/approvals/${b.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-subtle">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {contact} {b.reference ? <span className="text-muted">· {b.reference}</span> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <span className="truncate">{job}</span>
                        {stage && <span>· {stage}</span>}
                        {b.kind === "subcontractor" && stageStatus && (
                          <Badge tone={stageStatus === "signed_off" ? "green" : stageStatus === "complete" ? "amber" : "red"}>
                            {stageStatus === "signed_off" ? "Work signed off" : stageStatus === "complete" ? "Work needs checking" : "Work not complete"}
                          </Badge>
                        )}
                        {b.kind === "labour_hire" && b.hours ? <span>· {hours(b.hours)} billed</span> : null}
                        {b.dueDate && <span>· due {fmtDate(b.dueDate)}</span>}
                      </div>
                    </div>
                    <span className="font-semibold tabular-nums">{money(b.amountCents)}</span>
                    <ChevronRight className="size-4 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ))}
    </div>
  );
}

async function HoursTab() {
  const from = addDays(weekStart(today()), -35);
  const rows = await db
    .select({ l: labourEntries, user: users.name, rate: users.hourlyRateCents, job: jobs.name })
    .from(labourEntries)
    .innerJoin(jobs, eq(jobs.id, labourEntries.jobId))
    .leftJoin(users, eq(users.id, labourEntries.userId))
    .where(and(eq(labourEntries.kind, "sdl"), gte(labourEntries.date, from)))
    .orderBy(desc(labourEntries.date));

  const weeks = new Map<string, { userId: number; user: string; week: string; rate: number; rows: typeof rows }>();
  for (const r of rows) {
    if (!r.l.userId) continue;
    const key = `${weekStart(r.l.date)}|${r.l.userId}`;
    const w = weeks.get(key) ?? { userId: r.l.userId, user: r.user ?? "?", week: weekStart(r.l.date), rate: r.rate ?? 0, rows: [] };
    w.rows.push(r);
    weeks.set(key, w);
  }
  const list = [...weeks.values()].sort((a, b) => (a.week === b.week ? a.user.localeCompare(b.user) : b.week.localeCompare(a.week)));
  if (!list.length)
    return (
      <div className="card">
        <EmptyState title="No supervisor hours logged">Supervisors record their hours in the daily log. Only SDL supervisor hours are approved here – KPR hours are checked against KPR invoices.</EmptyState>
      </div>
    );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {list.map((w) => {
        const total = w.rows.reduce((s, r) => s + r.l.hours, 0);
        const pending = w.rows.filter((r) => !r.l.approvedAt);
        const days = Array.from({ length: 7 }, (_, i) => addDays(w.week, i));
        return (
          <Card
            key={`${w.week}${w.userId}`}
            title={
              <span className="flex items-center gap-2">
                <Avatar name={w.user} size="sm" /> {w.user} · week of {fmtDate(w.week)}
              </span>
            }
            action={pending.length === 0 ? <Badge tone="green">Approved</Badge> : <Badge tone="amber">To approve</Badge>}
          >
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {days.map((d) => {
                const h = w.rows.filter((r) => r.l.date === d).reduce((s, r) => s + r.l.hours, 0);
                return (
                  <div key={d} className={cx("rounded-lg py-1.5", h ? "bg-accent-soft" : "bg-subtle")}>
                    <div className="text-muted">{fmtDate(d, { weekday: true }).split(" ")[0]}</div>
                    <div className="font-semibold tabular-nums">{h ? h : "–"}</div>
                  </div>
                );
              })}
            </div>
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {[...new Set(w.rows.map((r) => r.job))].map((j) => (
                <li key={j} className="flex justify-between">
                  <span>{j}</span>
                  <span className="tabular-nums">{hours(w.rows.filter((r) => r.job === j).reduce((s, r) => s + r.l.hours, 0))}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <div className="text-sm">
                <b className="tabular-nums">{hours(total)}</b>
                {w.rate ? <span className="text-muted"> · {money(total * w.rate, true)}</span> : null}
              </div>
              {pending.length > 0 && (
                <ActionButton action={approveTimesheet.bind(null, w.userId, w.week)} className="btn-sm btn-primary">
                  Approve {hours(pending.reduce((s, r) => s + r.l.hours, 0))}
                </ActionButton>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

async function LabourTab({ rows }: { rows: { b: typeof labourBookings.$inferSelect; job: string; by: string | null }[] }) {
  const msgs = await Promise.all(rows.map((r) => docMessage("booking", r.b.id)));
  const smtp = emailEnabled();
  if (!rows.length)
    return (
      <div className="card">
        <EmptyState icon={<HardHat className="size-5" />} title="No labour requests">All KPR labour is requested from site and booked by the office here.</EmptyState>
      </div>
    );
  return (
    <Card pad={false}>
      <ul className="divide-y divide-line">
        {rows.map(({ b, job, by }, i) => (
          <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {b.workers} worker{b.workers > 1 ? "s" : ""} · {fmtDate(b.date, { weekday: true })}
                {b.days > 1 ? ` – ${fmtDate(addDays(b.date, b.days - 1), { weekday: true })}` : ""} · {job}
              </div>
              <div className="text-xs text-muted">
                {b.task || "General labour"} · {b.hours}h/day from {b.startTime} · requested by {by} {timeAgo(b.createdAt)}
              </div>
            </div>
            {msgs[i] && (
              <SendDialog
                title={`Send order PO-${b.id} to KPR`}
                trigger="Book with KPR"
                triggerClassName="btn btn-sm btn-primary"
                message={msgs[i]!}
                smtp={smtp}
                action={sendDoc.bind(null, "booking", b.id)}
                manualLabel="Booked by phone – mark booked"
              />
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

async function HistoryTab() {
  const [rows, conn] = await Promise.all([
    db
      .select({ b: bills, contact: contacts.name, job: jobs.name })
      .from(bills)
      .innerJoin(jobs, eq(jobs.id, bills.jobId))
      .leftJoin(contacts, eq(contacts.id, bills.contactId))
      .where(inArray(bills.status, ["approved", "paid", "rejected"]))
      .orderBy(desc(bills.approvedAt), desc(bills.createdAt))
      .limit(100),
    getXeroConnection(),
  ]);
  const xero = xeroConfigured() && !!conn;
  return (
    <Card
      pad={false}
      title="Approved, paid & rejected"
      action={
        xero ? (
          <ActionButton action={syncXero} className="btn-sm">
            <RefreshCw className="size-4" /> Sync paid from Xero
          </ActionButton>
        ) : null
      }
    >
      {rows.length === 0 ? (
        <EmptyState title="No history yet" />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map(({ b, contact, job }) => (
            <li key={b.id}>
              <Link href={`/office/approvals/${b.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-subtle">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {contact} {b.reference ? `· ${b.reference}` : ""}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {job} · {b.approvedAt ? `approved ${fmtDate(b.approvedAt.toISOString())}` : fmtDate(b.invoiceDate)}
                    {b.xeroBillId ? " · in Xero" : ""}
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums">{money(b.amountCents)}</span>
                <StatusBadge map={BILL_STATUSES} value={b.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
