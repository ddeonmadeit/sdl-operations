import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand";
import { InductionForm } from "@/components/induction-form";
import { db } from "@/db";
import { contacts, jobs } from "@/db/schema";
import { selfInduct } from "@/lib/actions/public";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "Site induction", robots: { index: false } };

export default async function SelfInductionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [job] = await db.select().from(jobs).where(eq(jobs.inductionToken, token));
  if (!job || ["completed", "lost"].includes(job.status)) notFound();
  const [{ inductionItems }, company, subbies] = await Promise.all([
    getSetting("templates"),
    getSetting("company"),
    db.select({ name: contacts.name }).from(contacts).where(eq(contacts.archived, false)),
  ]);
  return (
    <main className="safe-top mx-auto max-w-lg px-4 py-6">
      <div className="mb-5">
        <Logo className="mb-4 w-36" />
        <div className="sr-only">{company.name}</div>
        <h1 className="text-2xl font-bold tracking-tight">Site induction</h1>
        <p className="text-sm text-muted">{job.siteAddress ?? job.name}</p>
      </div>
      <div className="card p-4">
        <InductionForm action={selfInduct.bind(null, token)} items={inductionItems} siteInfo={job.siteInfo} companies={subbies.map((s) => s.name)} />
      </div>
      <p className="mt-4 text-center text-xs text-muted">Your details are kept on the site induction register for this job.</p>
    </main>
  );
}
