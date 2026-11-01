import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { ActionForm, Modal, SubmitButton } from "@/components/client";
import { BillFields } from "@/components/office/bill-fields";
import { Card, cx, EmptyState, Stat, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { bills, contacts } from "@/db/schema";
import { createBill } from "@/lib/actions/bills";
import { requireOffice } from "@/lib/auth";
import { BILL_KINDS, BILL_STATUSES } from "@/lib/constants";
import { fmtDate, hours, money, pct } from "@/lib/format";
import { contactOptions, getJob, jobFinance, jobStages } from "@/lib/queries";

export default async function CostsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOffice();
  const { id } = await params;
  const job = await getJob(Number(id));
  const [f, stageRows, billRows, people] = await Promise.all([
    jobFinance(job.id),
    jobStages(job.id),
    db
      .select({ b: bills, contact: contacts.name })
      .from(bills)
      .leftJoin(contacts, eq(contacts.id, bills.contactId))
      .where(eq(bills.jobId, job.id))
      .orderBy(desc(bills.createdAt)),
    contactOptions(["labour_hire", "subcontractor", "supplier"]),
  ]);
  const kprDiff = f.kprHoursBilled - f.kprHoursLogged;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Revenue (contract + variations)" value={money(f.revenue, true)} sub={f.variationRevenue ? `incl. ${money(f.variationRevenue, true)} variations` : undefined} />
        <Stat label="Cost to date" value={money(f.actual, true)} sub={f.pendingBills ? `+ ${money(f.pendingBills, true)} waiting approval` : "All invoices checked"} />
        <Stat label="Forecast final cost" value={money(f.forecastCost, true)} sub={`Budget ${money(f.budget, true)}`} />
        <Stat
          label="Forecast margin"
          value={f.revenue ? pct(f.forecastMarginPct) : "–"}
          sub={`${money(f.forecastMargin, true)} · quoted ${pct(f.budgetMarginPct)}`}
          tone={!f.revenue ? "default" : f.forecastMarginPct < 10 ? "bad" : f.forecastMarginPct < f.budgetMarginPct - 2 ? "warn" : "good"}
        />
      </div>

      <Card title="By stage" pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 text-right font-medium">Budget</th>
                <th className="px-3 py-2 text-right font-medium">Committed</th>
                <th className="px-3 py-2 text-right font-medium">Actual</th>
                <th className="px-3 py-2 text-right font-medium">Waiting</th>
                <th className="px-4 py-2 text-right font-medium">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {f.stages.map((s) => {
                const projected = Math.max(s.committed, s.actual);
                const variance = s.budget - projected;
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-2.5 font-medium">{s.name}</td>
                    <td className="px-3 py-2.5 text-right">{s.budget ? money(s.budget, true) : "–"}</td>
                    <td className="px-3 py-2.5 text-right">{s.committed ? money(s.committed, true) : "–"}</td>
                    <td className="px-3 py-2.5 text-right">{s.actual ? money(s.actual, true) : "–"}</td>
                    <td className="px-3 py-2.5 text-right text-muted">{s.pending ? money(s.pending, true) : ""}</td>
                    <td className={cx("px-4 py-2.5 text-right font-medium", projected > 0 && variance < 0 && "text-clay", projected > 0 && variance >= 0 && "text-leaf")}>
                      {projected ? money(variance, true) : ""}
                    </td>
                  </tr>
                );
              })}
              {f.variationCost > 0 && (
                <tr>
                  <td className="px-4 py-2.5 font-medium">Approved variations (cost)</td>
                  <td className="px-3 py-2.5 text-right">{money(f.variationCost, true)}</td>
                  <td colSpan={4} />
                </tr>
              )}
              {f.unallocatedActual > 0 && (
                <tr>
                  <td className="px-4 py-2.5 text-muted">Not allocated to a stage</td>
                  <td />
                  <td />
                  <td className="px-3 py-2.5 text-right">{money(f.unallocatedActual, true)}</td>
                  <td colSpan={2} />
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line font-semibold tabular-nums">
                <td className="px-4 py-2.5">Total</td>
                <td className="px-3 py-2.5 text-right">{money(f.budget, true)}</td>
                <td className="px-3 py-2.5 text-right">{money(f.committed, true)}</td>
                <td className="px-3 py-2.5 text-right">{money(f.actual, true)}</td>
                <td className="px-3 py-2.5 text-right text-muted">{f.pendingBills ? money(f.pendingBills, true) : ""}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
          Committed = subcontract agreements sent or signed. Actual = approved invoices + SDL supervisor hours × their hourly rate.
        </p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="KPR labour hours">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xs text-muted">Booked</div>
              <div className="text-xl font-bold tabular-nums">{hours(f.kprHoursBooked)}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Logged on site</div>
              <div className="text-xl font-bold tabular-nums">{hours(f.kprHoursLogged)}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Invoiced</div>
              <div className={cx("text-xl font-bold tabular-nums", kprDiff > 0.5 && "text-clay")}>{hours(f.kprHoursBilled)}</div>
            </div>
          </div>
          {kprDiff > 0.5 && (
            <p className="mt-3 rounded-lg bg-clay-soft px-3 py-2 text-sm text-clay-ink">
              KPR has invoiced {hours(kprDiff)} more than supervisors logged. Check before approving.
            </p>
          )}
        </Card>
        <Card title="SDL supervisor hours">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div>
              <div className="text-xs text-muted">Hours logged</div>
              <div className="text-xl font-bold tabular-nums">{hours(f.sdlHours)}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Cost</div>
              <div className="text-xl font-bold tabular-nums">{money(f.sdlCost, true)}</div>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">Hourly rates are set per supervisor in Settings → Team.</p>
        </Card>
      </div>

      <Card
        title="Invoices for this job"
        pad={false}
        action={
          <Modal title="Add invoice for checking" trigger={<><Plus className="size-4" /> Invoice</>} triggerClassName="btn btn-sm">
            <ActionForm action={createBill} success="Invoice added">
              <BillFields jobId={job.id} stages={stageRows} contacts={people} />
              <SubmitButton className="btn-primary mt-4 w-full">Add invoice</SubmitButton>
            </ActionForm>
          </Modal>
        }
      >
        {billRows.length === 0 ? (
          <EmptyState title="No invoices yet" />
        ) : (
          <ul className="divide-y divide-line">
            {billRows.map(({ b, contact }) => (
              <li key={b.id}>
                <Link href={`/office/approvals/${b.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-subtle">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {contact} {b.reference ? `· ${b.reference}` : ""}
                    </div>
                    <div className="truncate text-xs text-muted">
                      {BILL_KINDS[b.kind as keyof typeof BILL_KINDS]} · {stageRows.find((s) => s.id === b.stageId)?.name ?? "No stage"} · {fmtDate(b.invoiceDate)}
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
    </div>
  );
}
