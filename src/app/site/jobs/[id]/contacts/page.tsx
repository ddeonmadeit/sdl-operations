import { asc, eq, inArray, ne } from "drizzle-orm";
import { Mail, MessageSquare, Phone } from "lucide-react";
import { Section, SiteHeader } from "@/components/site/site-ui";
import { Avatar } from "@/components/ui";
import { db } from "@/db";
import { contacts, jobContacts, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { telHref } from "@/lib/format";
import { getJob, jobStages } from "@/lib/queries";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "Contacts" };

type Person = { key: string; name: string; role: string; phone?: string | null; email?: string | null };

function PersonRow({ p }: { p: Person }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar name={p.name} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{p.name}</div>
        <div className="truncate text-xs text-muted">{p.role}</div>
      </div>
      {p.phone && (
        <>
          <a href={`sms:${p.phone.replace(/[^\d+]/g, "")}`} className="btn btn-icon btn-sm rounded-full" aria-label={`Text ${p.name}`}>
            <MessageSquare className="size-4" />
          </a>
          <a href={telHref(p.phone)} className="btn btn-icon btn-sm rounded-full border-accent bg-accent text-cream" aria-label={`Call ${p.name}`}>
            <Phone className="size-4" />
          </a>
        </>
      )}
      {!p.phone && p.email && (
        <a href={`mailto:${p.email}`} className="btn btn-icon btn-sm rounded-full" aria-label={`Email ${p.name}`}>
          <Mail className="size-4" />
        </a>
      )}
    </div>
  );
}

export default async function SiteContacts({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const job = await getJob(Number(id));
  const [stageRows, extra, kpr, officeStaff, company] = await Promise.all([
    jobStages(job.id),
    db
      .select({ c: contacts, role: jobContacts.role })
      .from(jobContacts)
      .innerJoin(contacts, eq(contacts.id, jobContacts.contactId))
      .where(eq(jobContacts.jobId, job.id)),
    db.select().from(contacts).where(eq(contacts.type, "labour_hire")).orderBy(asc(contacts.id)),
    db.select().from(users).where(inArray(users.role, ["admin", "office"])).then((r) => r.filter((u) => u.active && u.phone)),
    getSetting("company"),
  ]);
  const subbies = stageRows.filter((s) => s.contact).map((s) => ({ key: `s${s.id}`, name: s.contact!.name, role: s.name, phone: s.contact!.phone, email: s.contact!.email }));

  return (
    <>
      <SiteHeader back={`/site/jobs/${job.id}`} title="Contacts" sub={job.name} />
      {job.client && (
        <Section title="Client">
          <div className="card">
            <PersonRow p={{ key: "client", name: job.client.contactName || job.client.name, role: job.client.name, phone: job.client.phone, email: job.client.email }} />
          </div>
        </Section>
      )}
      <Section title="SDL">
        <div className="card divide-y divide-line">
          {company.phone && <PersonRow p={{ key: "office", name: `${company.name} office`, role: "Office", phone: company.phone, email: company.email }} />}
          {job.supervisor && <PersonRow p={{ key: "sup", name: job.supervisor.name, role: "Supervisor", phone: job.supervisor.phone }} />}
          {officeStaff.map((u) => (
            <PersonRow key={u.id} p={{ key: `u${u.id}`, name: u.name, role: "Office", phone: u.phone, email: u.email }} />
          ))}
        </div>
      </Section>
      {subbies.length > 0 && (
        <Section title="Subcontractors">
          <div className="card divide-y divide-line">
            {subbies.map((p) => (
              <PersonRow key={p.key} p={p} />
            ))}
          </div>
        </Section>
      )}
      <Section title="Suppliers & labour hire">
        <div className="card divide-y divide-line">
          {kpr.map((k) => (
            <PersonRow key={k.id} p={{ key: `k${k.id}`, name: k.name, role: "Labour hire – book through the office", phone: k.phone, email: k.email }} />
          ))}
          {extra
            .filter(({ c }) => c.type !== "labour_hire")
            .map(({ c, role }) => (
              <PersonRow key={c.id} p={{ key: `c${c.id}`, name: c.name, role: role || "Supplier", phone: c.phone, email: c.email }} />
            ))}
        </div>
      </Section>
    </>
  );
}
