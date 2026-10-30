import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { FileSignature, FileText, Plus } from "lucide-react";
import { ActionForm, Modal, SubmitButton } from "@/components/client";
import { Badge, Card, EmptyState, RowLink, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { contacts, contracts, quoteItems, quotes } from "@/db/schema";
import { createContract } from "@/lib/actions/contracts";
import { createQuote } from "@/lib/actions/quotes";
import { requireOffice } from "@/lib/auth";
import { CONTRACT_STATUSES, QUOTE_STATUSES } from "@/lib/constants";
import { fmtDate, money } from "@/lib/format";
import { contactOptions, getJob, jobStages } from "@/lib/queries";

export default async function QuotesPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOffice();
  const { id } = await params;
  const job = await getJob(Number(id));
  const [quoteRows, contractRows, stageRows, subbies] = await Promise.all([
    db
      .select({
        q: quotes,
        sell: sql<number>`coalesce(sum(${quoteItems.qty} * ${quoteItems.unitPriceCents}), 0)`,
        cost: sql<number>`coalesce(sum(${quoteItems.qty} * ${quoteItems.unitCostCents}), 0)`,
      })
      .from(quotes)
      .leftJoin(quoteItems, eq(quoteItems.quoteId, quotes.id))
      .where(eq(quotes.jobId, job.id))
      .groupBy(quotes.id)
      .orderBy(desc(quotes.createdAt)),
    db
      .select({ c: contracts, contact: contacts.name })
      .from(contracts)
      .leftJoin(contacts, eq(contacts.id, contracts.contactId))
      .where(eq(contracts.jobId, job.id))
      .orderBy(desc(contracts.createdAt)),
    jobStages(job.id),
    contactOptions(["subcontractor"]),
  ]);
  const clientContracts = contractRows.filter((c) => c.c.kind === "client");
  const subcontracts = contractRows.filter((c) => c.c.kind === "subcontract");
  const subStages = stageRows.filter((s) => s.kind === "subcontractor");

  const newQuote = (kind: "estimate" | "quote", label: string) => (
    <ActionForm action={createQuote.bind(null, job.id)}>
      <input type="hidden" name="kind" value={kind} />
      <SubmitButton className={kind === "quote" ? "btn-primary btn-sm" : "btn-sm"}>
        <Plus className="size-4" /> {label}
      </SubmitButton>
    </ActionForm>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card
        title="Estimates & quotes"
        pad={false}
        className="lg:col-span-2"
        action={
          <div className="flex gap-2">
            {newQuote("estimate", "Estimate")}
            {newQuote("quote", "Quote")}
          </div>
        }
      >
        {quoteRows.length === 0 ? (
          <EmptyState icon={<FileText className="size-5" />} title="No quotes yet">
            Start with a quick estimate, or go straight to a quote. Line items are grouped by stage so the accepted quote sets each stage&apos;s budget and the site scope.
          </EmptyState>
        ) : (
          <div>
            {quoteRows.map(({ q, sell, cost }) => (
              <RowLink key={q.id} href={`/office/quotes/${q.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium">
                      Q{q.id} · {q.title}
                      {q.kind === "estimate" && <Badge tone="violet">Estimate</Badge>}
                    </div>
                    <div className="text-xs text-muted">
                      {q.sentAt ? `Sent ${fmtDate(q.sentAt.toISOString())}` : `Created ${fmtDate(q.createdAt.toISOString())}`}
                      {q.acceptedName ? ` · Accepted by ${q.acceptedName}` : ""}
                      {Number(sell) > 0 && ` · Margin ${money(Number(sell) - Number(cost), true)}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold tabular-nums">{money(Number(sell), true)}</span>
                    <StatusBadge map={QUOTE_STATUSES} value={q.status} />
                  </div>
                </div>
              </RowLink>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Client contract"
        pad={false}
        action={
          clientContracts.length === 0 ? (
            <ActionForm action={createContract.bind(null, job.id)}>
              <input type="hidden" name="kind" value="client" />
              <SubmitButton className="btn-sm">
                <Plus className="size-4" /> Create
              </SubmitButton>
            </ActionForm>
          ) : null
        }
      >
        {clientContracts.length === 0 ? (
          <EmptyState icon={<FileSignature className="size-5" />} title="No contract yet">
            Created from the job and your contract template, then signed online by the client.
          </EmptyState>
        ) : (
          clientContracts.map(({ c, contact }) => (
            <RowLink key={c.id} href={`/office/contracts/${c.id}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.title}</div>
                  <div className="text-xs text-muted">
                    {contact} · {money(c.amountCents, true)}
                    {c.signedName ? ` · Signed by ${c.signedName}` : ""}
                  </div>
                </div>
                <StatusBadge map={CONTRACT_STATUSES} value={c.status} />
              </div>
            </RowLink>
          ))
        )}
      </Card>

      <Card
        title="Subcontractor agreements"
        pad={false}
        action={
          <Modal title="New subcontract agreement" trigger={<><Plus className="size-4" /> Agreement</>} triggerClassName="btn btn-sm">
            <ActionForm action={createContract.bind(null, job.id)}>
              <input type="hidden" name="kind" value="subcontract" />
              <div className="space-y-3">
                <label className="block">
                  <span className="label">Stage</span>
                  <select name="stageId" className="input" required>
                    {subStages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.contact ? ` – ${s.contact.name}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Subcontractor</span>
                  <select name="contactId" className="input">
                    <option value="">Use the stage&apos;s subcontractor</option>
                    {subbies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.trade ? ` · ${s.trade}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="hint">The scope and price are filled in from the stage – you can edit before sending.</p>
              </div>
              <SubmitButton className="btn-primary mt-4 w-full">Create agreement</SubmitButton>
            </ActionForm>
          </Modal>
        }
      >
        {subStages.length === 0 ? (
          <EmptyState title="No subcontractor stages" />
        ) : (
          <ul className="divide-y divide-line">
            {subStages.map((s) => {
              const list = subcontracts.filter((c) => c.c.stageId === s.id);
              return (
                <li key={s.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{s.name}</div>
                      <div className="truncate text-xs text-muted">{s.contact?.name ?? "No subcontractor assigned"}</div>
                    </div>
                    {list.length === 0 && (
                      <ActionForm action={createContract.bind(null, job.id)}>
                        <input type="hidden" name="kind" value="subcontract" />
                        <input type="hidden" name="stageId" value={s.id} />
                        {s.contactId ? (
                          <SubmitButton className="btn-sm">Create</SubmitButton>
                        ) : (
                          <span className="text-xs text-muted">Assign a subbie first</span>
                        )}
                      </ActionForm>
                    )}
                  </div>
                  {list.map(({ c, contact }) => (
                    <Link key={c.id} href={`/office/contracts/${c.id}`} className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-subtle px-3 py-2 text-sm hover:bg-line">
                      <span className="truncate">
                        {contact} · {money(c.amountCents, true)}
                      </span>
                      <StatusBadge map={CONTRACT_STATUSES} value={c.status} />
                    </Link>
                  ))}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
