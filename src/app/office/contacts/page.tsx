import Link from "next/link";
import { and, asc, eq, type SQL } from "drizzle-orm";
import { Mail, Phone, Plus, Users } from "lucide-react";
import { ActionForm, Modal, SubmitButton } from "@/components/client";
import { ContactFields } from "@/components/office/contact-fields";
import { Badge, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { createContact } from "@/lib/actions/admin";
import { requireOffice } from "@/lib/auth";
import { CONTACT_TYPES, type ContactType } from "@/lib/constants";
import { telHref } from "@/lib/format";

export const metadata = { title: "Contacts" };

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ type?: string; q?: string; archived?: string }> }) {
  await requireOffice();
  const sp = await searchParams;
  const type = sp.type && sp.type in CONTACT_TYPES ? (sp.type as ContactType) : undefined;
  const conds: SQL[] = [eq(contacts.archived, sp.archived === "1")];
  if (type) conds.push(eq(contacts.type, type));
  let rows = await db.select().from(contacts).where(and(...conds)).orderBy(asc(contacts.name));
  const q = sp.q?.trim().toLowerCase();
  if (q) rows = rows.filter((c) => [c.name, c.contactName, c.trade, c.email, c.phone].some((v) => v?.toLowerCase().includes(q)));

  return (
    <>
      <PageHeader
        title="Contacts"
        subtitle="Clients, subcontractors, suppliers and KPR"
        actions={
          <Modal title="New contact" trigger={<><Plus className="size-4" /> New contact</>} triggerClassName="btn btn-primary">
            <ActionForm action={createContact} success="Contact added">
              <ContactFields type={type} />
              <SubmitButton className="btn-primary mt-4 w-full">Add contact</SubmitButton>
            </ActionForm>
          </Modal>
        }
      />
      <Tabs
        current={type ? `/office/contacts?type=${type}` : "/office/contacts"}
        tabs={[{ href: "/office/contacts", label: "All" }, ...Object.entries(CONTACT_TYPES).map(([k, l]) => ({ href: `/office/contacts?type=${k}`, label: l }))]}
      />
      <form className="mb-4">
        {type && <input type="hidden" name="type" value={type} />}
        <input name="q" type="search" defaultValue={sp.q} placeholder="Search name, trade, phone…" className="input max-w-md" />
      </form>
      {rows.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Users className="size-5" />} title="No contacts" />
        </div>
      ) : (
        <div className="card divide-y divide-line">
          {rows.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <Link href={`/office/contacts/${c.id}`} className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium hover:underline">{c.name}</span>
                  <Badge tone={c.type === "client" ? "info" : c.type === "subcontractor" ? "strong" : c.type === "labour_hire" ? "warn" : "neutral"}>
                    {CONTACT_TYPES[c.type as ContactType]}
                  </Badge>
                </div>
                <div className="truncate text-xs text-muted">{[c.contactName, c.trade, c.email].filter(Boolean).join(" · ")}</div>
              </Link>
              {c.phone && (
                <a href={telHref(c.phone)} className="btn btn-ghost btn-icon btn-sm" aria-label={`Call ${c.name}`}>
                  <Phone className="size-4" />
                </a>
              )}
              {c.email && (
                <a href={`mailto:${c.email}`} className="btn btn-ghost btn-icon btn-sm" aria-label={`Email ${c.name}`}>
                  <Mail className="size-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 text-center">
        <Link href={sp.archived === "1" ? "/office/contacts" : "/office/contacts?archived=1"} className="text-sm text-muted hover:text-ink">
          {sp.archived === "1" ? "Back to active contacts" : "Show archived contacts"}
        </Link>
      </div>
    </>
  );
}
