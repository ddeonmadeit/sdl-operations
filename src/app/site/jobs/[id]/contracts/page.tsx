import { and, asc, eq, inArray } from "drizzle-orm";
import { FileSignature } from "lucide-react";
import { Section, SiteHeader } from "@/components/site/site-ui";
import { EmptyState, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { contacts, contracts, stages } from "@/db/schema";
import { isOffice, requireUser } from "@/lib/auth";
import { CONTRACT_STATUSES } from "@/lib/constants";
import { fmtDate, money } from "@/lib/format";
import { getJob } from "@/lib/queries";

export const metadata = { title: "Contracts" };

/** What's been agreed with the client and each subbie – scope and terms. Prices only for office users. */
export default async function SiteContracts({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const job = await getJob(Number(id));
  const rows = await db
    .select({ c: contracts, contact: contacts.name, stage: stages.name })
    .from(contracts)
    .leftJoin(contacts, eq(contacts.id, contracts.contactId))
    .leftJoin(stages, eq(stages.id, contracts.stageId))
    .where(and(eq(contracts.jobId, job.id), inArray(contracts.status, ["sent", "signed"])))
    .orderBy(asc(contracts.kind), asc(stages.sortOrder));
  const showPrice = isOffice(me);
  const groups = [
    { title: "Client contract", items: rows.filter((r) => r.c.kind === "client") },
    { title: "Subcontractor agreements", items: rows.filter((r) => r.c.kind === "subcontract") },
  ].filter((g) => g.items.length);

  return (
    <>
      <SiteHeader back={`/site/jobs/${job.id}`} title="Contracts" sub={job.name} />
      {groups.length === 0 && (
        <div className="card">
          <EmptyState icon={<FileSignature className="size-5" />} title="Nothing sent yet">Contracts and subbie agreements appear here once the office sends them.</EmptyState>
        </div>
      )}
      {groups.map((g) => (
        <Section key={g.title} title={g.title}>
          <div className="space-y-2.5">
            {g.items.map(({ c, contact, stage }) => (
              <details key={c.id} className="card group overflow-hidden">
                <summary className="flex list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{c.kind === "client" ? contact ?? "Client" : `${stage ?? "Works"} · ${contact ?? ""}`}</div>
                    <div className="truncate text-xs text-muted">
                      {c.status === "signed" ? `Signed ${c.signedAt ? fmtDate(c.signedAt.toISOString()) : ""}` : "Sent, not signed yet"}
                      {showPrice ? ` · ${money(c.amountCents, true)} ex GST` : ""}
                    </div>
                  </div>
                  <StatusBadge map={CONTRACT_STATUSES} value={c.status} />
                </summary>
                <div className="space-y-3 border-t border-line px-4 py-3.5 text-sm">
                  <div>
                    <div className="label">Scope of works</div>
                    <p className="prose-pre text-ink-2">{c.scope || "See the scope of works for this stage."}</p>
                  </div>
                  {c.terms && (
                    <details>
                      <summary className="text-sm font-semibold text-accent">Read the terms</summary>
                      <p className="prose-pre mt-2 text-xs leading-relaxed text-ink-2">{c.terms}</p>
                    </details>
                  )}
                </div>
              </details>
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}
