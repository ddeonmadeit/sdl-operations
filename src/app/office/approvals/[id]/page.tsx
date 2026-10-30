import Link from "next/link";
import { and, asc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, CircleAlert, FileText, Trash2 } from "lucide-react";
import { ActionButton, ActionForm, Modal, SubmitButton } from "@/components/client";
import { Card, cx, KV, PageHeader, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { bills, contacts, contracts, files, jobs, labourBookings, labourEntries, scopeItems, stages } from "@/db/schema";
import { approveBill, deleteBill, rejectBill, sendBillToXero, setBillStatus } from "@/lib/actions/bills";
import { requireOffice } from "@/lib/auth";
import { BILL_KINDS, BILL_STATUSES, STAGE_STATUSES } from "@/lib/constants";
import { addDays, fmtDate, fmtDateTime, hours, money } from "@/lib/format";
import { getSetting, getXeroConnection } from "@/lib/settings";
import { xeroConfigured } from "@/lib/xero";

type Check = { ok: boolean | null; label: string; detail?: React.ReactNode };

export default async function BillPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOffice();
  const { id } = await params;
  const [row] = await db
    .select({ b: bills, contact: contacts, job: jobs })
    .from(bills)
    .innerJoin(jobs, eq(jobs.id, bills.jobId))
    .leftJoin(contacts, eq(contacts.id, bills.contactId))
    .where(eq(bills.id, Number(id)));
  if (!row) notFound();
  const { b, contact, job } = row;
  const [attachments, conn, rates] = await Promise.all([
    db.select().from(files).where(and(eq(files.ownerType, "bill"), eq(files.ownerId, b.id))),
    getXeroConnection(),
    getSetting("rates"),
  ]);
  const xero = xeroConfigured() && !!conn;
  const checks: Check[] = [];
  let context: React.ReactNode = null;

  if (b.kind === "subcontractor") {
    const [stage] = b.stageId ? await db.select().from(stages).where(eq(stages.id, b.stageId)) : [];
    const agreement = stage
      ? (
          await db
            .select()
            .from(contracts)
            .where(and(eq(contracts.stageId, stage.id), eq(contracts.kind, "subcontract"), ne(contracts.status, "cancelled")))
        )[0]
      : undefined;
    const [prior] = await db
      .select({ total: sql<number>`coalesce(sum(${bills.amountCents}), 0)` })
      .from(bills)
      .where(
        and(
          eq(bills.jobId, b.jobId),
          eq(bills.contactId, b.contactId ?? -1),
          b.stageId ? eq(bills.stageId, b.stageId) : undefined,
          inArray(bills.status, ["approved", "paid"]),
          ne(bills.id, b.id),
        ),
      );
    const scope = stage ? await db.select().from(scopeItems).where(eq(scopeItems.stageId, stage.id)) : [];
    const billedTotal = Number(prior?.total ?? 0) + b.amountCents;
    const limit = agreement?.amountCents ?? stage?.budgetCents ?? 0;
    checks.push({
      ok: stage ? stage.status === "signed_off" : null,
      label: stage ? `Work: ${stage.name} is ${STAGE_STATUSES[stage.status as keyof typeof STAGE_STATUSES]?.label.toLowerCase()}` : "No stage linked – check the work manually",
      detail: stage && stage.status === "complete" ? <Link href={`/office/approvals?tab=work`} className="text-accent underline">Check and sign off the stage first</Link> : null,
    });
    if (scope.length)
      checks.push({
        ok: scope.every((s) => s.doneAt),
        label: `Scope items ticked off on site: ${scope.filter((s) => s.doneAt).length}/${scope.length}`,
      });
    checks.push({
      ok: limit ? billedTotal <= limit : null,
      label: limit
        ? `Billed to date incl. this: ${money(billedTotal)} of ${money(limit)} ${agreement ? "agreed" : "budget"}`
        : "No agreement amount to compare against",
      detail: limit && billedTotal > limit ? <span className="text-red-700">Over by {money(billedTotal - limit)} – is there an approved variation?</span> : null,
    });
    checks.push({ ok: agreement ? agreement.status === "signed" : false, label: agreement ? `Subcontract agreement ${agreement.status}` : "No subcontract agreement on file" });
  } else if (b.kind === "labour_hire") {
    const from = b.periodFrom ?? (b.invoiceDate ? addDays(b.invoiceDate, -7) : null);
    const to = b.periodTo ?? b.invoiceDate;
    const logged = await db
      .select({ date: labourEntries.date, hours: sql<number>`sum(${labourEntries.hours})`, workers: sql<number>`count(*)` })
      .from(labourEntries)
      .where(
        and(
          eq(labourEntries.jobId, b.jobId),
          eq(labourEntries.kind, "kpr"),
          from ? gte(labourEntries.date, from) : undefined,
          to ? lte(labourEntries.date, to) : undefined,
        ),
      )
      .groupBy(labourEntries.date)
      .orderBy(asc(labourEntries.date));
    const booked = await db
      .select()
      .from(labourBookings)
      .where(and(eq(labourBookings.jobId, b.jobId), eq(labourBookings.status, "booked")));
    const loggedTotal = logged.reduce((s, l) => s + Number(l.hours), 0);
    const expected = loggedTotal * rates.kprHourlyCents;
    checks.push({
      ok: b.hours != null ? Math.abs(b.hours - loggedTotal) < 0.5 : null,
      label: b.hours != null ? `Hours: ${hours(b.hours)} invoiced vs ${hours(loggedTotal)} logged on site` : `${hours(loggedTotal)} logged on site – enter billed hours to compare`,
      detail: b.hours != null && b.hours - loggedTotal >= 0.5 ? <span className="text-red-700">{hours(b.hours - loggedTotal)} more than the supervisor logged</span> : null,
    });
    if (rates.kprHourlyCents)
      checks.push({
        ok: Math.abs(expected - b.amountCents) <= Math.max(500, b.amountCents * 0.02),
        label: `Expected at ${money(rates.kprHourlyCents)}/h: ${money(expected)} – invoiced ${money(b.amountCents)}`,
      });
    checks.push({ ok: booked.length > 0, label: booked.length ? `${booked.length} booking(s) placed through the office` : "No office booking found for this job" });
    context = (
      <Card title={`Logged KPR hours ${from ? `· ${fmtDate(from)}` : ""}${to ? ` – ${fmtDate(to)}` : ""}`} pad={false}>
        {logged.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">No KPR hours logged in this period.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {logged.map((l) => (
              <li key={l.date} className="flex justify-between px-4 py-2">
                <span>{fmtDate(l.date, { weekday: true })}</span>
                <span className="tabular-nums">
                  {Number(l.workers)} worker{Number(l.workers) > 1 ? "s" : ""} · {hours(Number(l.hours))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  } else {
    checks.push({ ok: null, label: "Supplier invoice – check the goods were delivered and the price matches the order" });
  }

  const allGood = checks.every((c) => c.ok !== false);

  return (
    <>
      <PageHeader
        back="/office/approvals"
        title={`${contact?.name ?? "Invoice"}${b.reference ? ` · ${b.reference}` : ""}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/office/jobs/${job.id}/costs`} className="font-medium text-ink-2 hover:underline">
              {job.name}
            </Link>
            <StatusBadge map={BILL_STATUSES} value={b.status} />
            {b.xeroBillId && <span>· In Xero</span>}
          </span>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card title="Checks before payment" pad={false}>
            <ul className="divide-y divide-line">
              {checks.map((c, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-3">
                  {c.ok === true ? (
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-600" />
                  ) : c.ok === false ? (
                    <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600" />
                  ) : (
                    <CircleAlert className="mt-0.5 size-5 shrink-0 text-muted" />
                  )}
                  <div className="text-sm">
                    <div className={cx(c.ok === false && "font-medium")}>{c.label}</div>
                    {c.detail && <div className="mt-0.5 text-xs">{c.detail}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          {context}
          {attachments.length > 0 && (
            <Card title="Invoice copy" pad={false}>
              {attachments.map((f) =>
                f.mimeType.startsWith("image/") ? (
                  <a key={f.id} href={`/api/files/${f.id}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/files/${f.id}`} alt={f.name} className="max-h-[600px] w-full object-contain" />
                  </a>
                ) : f.mimeType === "application/pdf" ? (
                  <iframe key={f.id} src={`/api/files/${f.id}`} className="h-[600px] w-full" title={f.name} />
                ) : (
                  <a key={f.id} href={`/api/files/${f.id}`} className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-accent">
                    <FileText className="size-4" /> {f.name}
                  </a>
                ),
              )}
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <div className="mb-4 text-center">
              <div className="text-3xl font-bold tabular-nums">{money(b.amountCents)}</div>
              <div className="text-xs text-muted">
                ex GST · {money(b.amountCents + b.gstCents)} inc GST
              </div>
            </div>
            <KV
              items={[
                ["Type", BILL_KINDS[b.kind as keyof typeof BILL_KINDS]],
                ["From", contact?.name],
                ["Invoice date", fmtDate(b.invoiceDate, { year: true })],
                ["Due", fmtDate(b.dueDate, { year: true })],
                ["Hours billed", b.hours != null ? hours(b.hours) : null],
                ["Description", b.description],
                ["Approved", b.approvedAt ? fmtDateTime(b.approvedAt) : null],
              ]}
            />
            {b.reviewNote && <p className="mt-3 rounded-lg bg-subtle p-3 text-sm">{b.reviewNote}</p>}
          </Card>

          {b.status === "pending" && (
            <Card title="Decision">
              <ActionForm action={approveBill.bind(null, b.id)} reset={false}>
                <textarea name="reviewNote" rows={2} className="input text-sm" placeholder="Note (optional)" />
                {xero && (
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input type="checkbox" name="toXero" defaultChecked className="size-4 accent-[var(--color-accent)]" />
                    Send to Xero as a bill
                  </label>
                )}
                {!allGood && <p className="mt-3 text-xs text-red-700">Some checks didn&apos;t pass – make sure you&apos;re happy before approving.</p>}
                <SubmitButton className="btn-primary mt-3 w-full">Approve for payment</SubmitButton>
              </ActionForm>
              <Modal title="Query / reject invoice" trigger="Query or reject" triggerClassName="btn mt-2 w-full">
                <ActionForm action={rejectBill.bind(null, b.id)}>
                  <textarea name="reviewNote" required rows={3} className="input" placeholder="What's wrong? e.g. 4 hours more than logged on site" />
                  <SubmitButton className="btn-primary mt-3 w-full">Reject</SubmitButton>
                </ActionForm>
              </Modal>
            </Card>
          )}
          {b.status === "approved" && (
            <Card>
              <div className="space-y-2">
                {xero && !b.xeroBillId && (
                  <ActionButton action={sendBillToXero.bind(null, b.id)} className="btn-primary w-full">
                    Send to Xero
                  </ActionButton>
                )}
                <ActionButton action={setBillStatus.bind(null, b.id, "paid")} className="w-full">
                  Mark as paid
                </ActionButton>
                <ActionButton action={setBillStatus.bind(null, b.id, "pending")} className="btn-ghost w-full">
                  Undo approval
                </ActionButton>
              </div>
            </Card>
          )}
          {(b.status === "rejected" || b.status === "paid") && (
            <ActionButton action={setBillStatus.bind(null, b.id, "pending")} className="w-full">
              Move back to checking
            </ActionButton>
          )}
          <ActionButton action={deleteBill.bind(null, b.id)} confirm="Delete this invoice record?" className="btn-ghost btn-danger btn-sm w-full">
            <Trash2 className="size-4" /> Delete
          </ActionButton>
        </div>
      </div>
    </>
  );
}
