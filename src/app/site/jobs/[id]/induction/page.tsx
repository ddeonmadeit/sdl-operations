import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { QrCode } from "lucide-react";
import { InductionForm } from "@/components/induction-form";
import { Section, SiteHeader } from "@/components/site/site-ui";
import { timeAgo } from "@/lib/format";
import { db } from "@/db";
import { contacts, inductions } from "@/db/schema";
import { createInduction } from "@/lib/actions/site";
import { requireUser } from "@/lib/auth";
import { getJob } from "@/lib/queries";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "Site induction" };

export default async function InductionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const job = await getJob(Number(id));
  const [{ inductionItems }, list, companies] = await Promise.all([
    getSetting("templates"),
    db.select().from(inductions).where(eq(inductions.jobId, job.id)).orderBy(desc(inductions.createdAt)),
    db.select({ name: contacts.name }).from(contacts).where(eq(contacts.archived, false)),
  ]);
  return (
    <>
      <SiteHeader
        back={`/site/jobs/${job.id}`}
        title="Site induction"
        sub={job.name}
        right={
          <Link href={`/site/jobs/${job.id}/induction/qr`} className="btn btn-sm shrink-0">
            <QrCode className="size-4" /> Worker QR
          </Link>
        }
      />
      <p className="mb-4 text-sm text-muted">
        Hand your phone to the worker, or show them the QR code so they can sign on their own phone.
      </p>
      <div className="card mb-6 p-4">
        <InductionForm action={createInduction.bind(null, job.id)} items={inductionItems} siteInfo={job.siteInfo} companies={companies.map((c) => c.name)} />
      </div>
      <Section title={`Signed (${list.length})`}>
        <div className="card divide-y divide-line">
          {list.length === 0 && <p className="px-4 py-4 text-sm text-muted">No one inducted yet.</p>}
          {list.map((i) => (
            <div key={i.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{i.name}</div>
                <div className="truncate text-xs text-muted">
                  {[i.company, i.whiteCard && `WC ${i.whiteCard}`, timeAgo(i.createdAt)].filter(Boolean).join(" · ")}
                </div>
              </div>
              {i.signatureData.length > 100 && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.signatureData} alt="" className="h-8 max-w-[90px] object-contain opacity-80" />
              )}
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
