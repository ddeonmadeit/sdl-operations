import Link from "next/link";
import { desc, eq, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Mail, MapPin, Phone } from "lucide-react";
import { ActionButton, ActionForm, SubmitButton } from "@/components/client";
import { ContactFields } from "@/components/office/contact-fields";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { bills, contacts, jobs, stages } from "@/db/schema";
import { archiveContact, updateContact } from "@/lib/actions/admin";
import { requireOffice } from "@/lib/auth";
import { BILL_STATUSES, CONTACT_TYPES, JOB_STATUSES, type ContactType } from "@/lib/constants";
import { fmtDate, money, telHref } from "@/lib/format";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOffice();
  const { id } = await params;
  const [c] = await db.select().from(contacts).where(eq(contacts.id, Number(id)));
  if (!c) notFound();
  const [jobRows, billRows] = await Promise.all([
    db
      .selectDistinct({ id: jobs.id, name: jobs.name, status: jobs.status, updatedAt: jobs.updatedAt })
      .from(jobs)
      .leftJoin(stages, eq(stages.jobId, jobs.id))
      .where(or(eq(jobs.clientId, c.id), eq(stages.contactId, c.id)))
      .orderBy(desc(jobs.updatedAt)),
    db
      .select({ b: bills, job: jobs.name })
      .from(bills)
      .innerJoin(jobs, eq(jobs.id, bills.jobId))
      .where(eq(bills.contactId, c.id))
      .orderBy(desc(bills.createdAt))
      .limit(20),
  ]);

  return (
    <>
      <PageHeader
        back="/office/contacts"
        title={c.name}
        subtitle={`${CONTACT_TYPES[c.type as ContactType]}${c.trade ? ` · ${c.trade}` : ""}${c.archived ? " · Archived" : ""}`}
        actions={
          <>
            {c.phone && (
              <a href={telHref(c.phone)} className="btn btn-sm">
                <Phone className="size-4" /> Call
              </a>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`} className="btn btn-sm">
                <Mail className="size-4" /> Email
              </a>
            )}
            {c.address && (
              <a href={`https://maps.google.com/?q=${encodeURIComponent(c.address)}`} target="_blank" rel="noreferrer" className="btn btn-sm">
                <MapPin className="size-4" /> Map
              </a>
            )}
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card title="Jobs" pad={false}>
            {jobRows.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted">Not linked to any jobs yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {jobRows.map((j) => (
                  <li key={j.id}>
                    <Link href={`/office/jobs/${j.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-subtle">
                      <span className="truncate text-sm font-medium">{j.name}</span>
                      <StatusBadge map={JOB_STATUSES} value={j.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {billRows.length > 0 && (
            <Card title="Invoices" pad={false}>
              <ul className="divide-y divide-line">
                {billRows.map(({ b, job }) => (
                  <li key={b.id}>
                    <Link href={`/office/approvals/${b.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-subtle">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{b.reference ?? "Invoice"} · {job}</div>
                        <div className="text-xs text-muted">{fmtDate(b.invoiceDate)}</div>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">{money(b.amountCents)}</span>
                      <StatusBadge map={BILL_STATUSES} value={b.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <Card title="Details">
          <ActionForm action={updateContact.bind(null, c.id)} reset={false}>
            <ContactFields c={c} />
            <SubmitButton className="btn-primary mt-4 w-full">Save</SubmitButton>
          </ActionForm>
          <ActionButton action={archiveContact.bind(null, c.id, !c.archived)} className="btn-ghost btn-sm mt-2 w-full">
            {c.archived ? "Restore contact" : "Archive contact"}
          </ActionButton>
        </Card>
      </div>
    </>
  );
}
