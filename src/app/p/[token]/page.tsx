import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/brand";
import { PrintButton } from "@/components/print-button";
import { SignForm } from "@/components/sign-form";
import { db } from "@/db";
import { contacts, contracts, jobs, quoteItems, quotes, stages, variations } from "@/db/schema";
import { declineDocument, signDocument } from "@/lib/actions/public";
import { fmtDate, fmtDateTime, money } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Document", robots: { index: false } };

export default async function PublicDoc({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { company, rates } = await getSettings(["company", "rates"]);
  const gst = (c: number) => Math.round((c * rates.gstPct) / 100);
  const sign = signDocument.bind(null, token);
  const decline = declineDocument.bind(null, token);

  let body: React.ReactNode;
  let title = "";
  let party: { label: string; name?: string | null } = { label: "" };
  let siteAddress: string | null = null;
  let signed: { name: string | null; at: Date | null; sig: string | null } | null = null;
  let form: React.ReactNode = null;
  let note: string | null = null;

  if (token.startsWith("q_")) {
    const [row] = await db
      .select({ q: quotes, job: jobs, client: contacts })
      .from(quotes)
      .innerJoin(jobs, eq(jobs.id, quotes.jobId))
      .leftJoin(contacts, eq(contacts.id, jobs.clientId))
      .where(eq(quotes.shareToken, token));
    if (!row) notFound();
    const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, row.q.id)).orderBy(asc(quoteItems.sortOrder));
    const sections = [...new Set(items.map((i) => i.section))];
    const total = items.reduce((s, i) => s + Math.round(i.qty * i.unitPriceCents), 0);
    title = `${row.q.kind === "estimate" ? "Estimate" : "Quote"} Q${row.q.id}`;
    party = { label: "Prepared for", name: row.client?.name };
    siteAddress = row.job.siteAddress;
    if (row.q.status === "accepted") signed = { name: row.q.acceptedName, at: row.q.acceptedAt, sig: row.q.signatureData };
    else if (row.q.status === "declined") note = "This quote was declined. Contact us if you'd like to revisit it.";
    else if (row.q.kind === "quote" && row.q.status === "sent")
      form = <SignForm sign={sign} decline={decline} agreeText={`I accept this quote of ${money(total + gst(total))} inc GST and the terms above.`} buttonText="Accept quote" defaultName={row.client?.contactName ?? row.client?.name ?? ""} />;
    body = (
      <>
        <h2 className="text-lg font-semibold">{row.q.title}</h2>
        {row.q.validUntil && <p className="text-sm text-muted">Valid until {fmtDate(row.q.validUntil, { year: true })}</p>}
        <div className="mt-5 space-y-5">
          {sections.map((sec) => {
            const list = items.filter((i) => i.section === sec);
            return (
              <div key={sec}>
                <div className="mb-1 flex justify-between border-b border-line pb-1 text-sm font-semibold">
                  <span>{sec || "General"}</span>
                  <span className="tabular-nums">{money(list.reduce((s, i) => s + Math.round(i.qty * i.unitPriceCents), 0))}</span>
                </div>
                <ul className="space-y-1 text-sm">
                  {list.map((i) => (
                    <li key={i.id} className="flex justify-between gap-4">
                      <span className="text-ink-2">
                        {i.description}
                        {(i.qty !== 1 || i.unit !== "item") && <span className="text-muted"> · {i.qty} {i.unit}</span>}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted">{money(Math.round(i.qty * i.unitPriceCents))}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <Totals ex={total} gst={gst(total)} />
        {row.q.notes && <Terms text={row.q.notes} />}
      </>
    );
  } else if (token.startsWith("c_")) {
    const [row] = await db
      .select({ c: contracts, job: jobs, contact: contacts, stage: stages })
      .from(contracts)
      .innerJoin(jobs, eq(jobs.id, contracts.jobId))
      .leftJoin(contacts, eq(contacts.id, contracts.contactId))
      .leftJoin(stages, eq(stages.id, contracts.stageId))
      .where(eq(contracts.shareToken, token));
    if (!row || row.c.status === "draft") notFound();
    const sub = row.c.kind === "subcontract";
    title = sub ? "Subcontract agreement" : "Contract";
    party = { label: sub ? "Subcontractor" : "Client", name: row.contact?.name };
    siteAddress = row.job.siteAddress;
    if (row.c.status === "signed") signed = { name: row.c.signedName, at: row.c.signedAt, sig: row.c.signatureData };
    else if (row.c.status === "cancelled") note = "This document has been cancelled.";
    else form = <SignForm sign={sign} agreeText={`I have read and agree to this ${sub ? "agreement" : "contract"}, including the price of ${money(row.c.amountCents)} ex GST and the terms.`} buttonText="Sign" defaultName={row.contact?.contactName ?? row.contact?.name ?? ""} />;
    body = (
      <>
        <h2 className="text-lg font-semibold">{row.c.title}</h2>
        {row.stage && <p className="text-sm text-muted">Stage: {row.stage.name}</p>}
        {row.c.scope && (
          <section className="mt-5">
            <h3 className="mb-1 text-sm font-semibold">Scope of works</h3>
            <p className="prose-pre text-sm text-ink-2">{row.c.scope}</p>
          </section>
        )}
        <Totals ex={row.c.amountCents} gst={gst(row.c.amountCents)} label={sub ? "Agreed price" : "Contract price"} />
        {row.c.terms && <Terms text={row.c.terms} />}
      </>
    );
  } else if (token.startsWith("v_")) {
    const [row] = await db
      .select({ v: variations, job: jobs, client: contacts })
      .from(variations)
      .innerJoin(jobs, eq(jobs.id, variations.jobId))
      .leftJoin(contacts, eq(contacts.id, jobs.clientId))
      .where(eq(variations.shareToken, token));
    if (!row || ["identified", "priced"].includes(row.v.status)) notFound();
    title = `Variation V${row.v.number}`;
    party = { label: "Client", name: row.client?.name };
    siteAddress = row.job.siteAddress;
    if (row.v.status === "approved" || row.v.status === "invoiced") signed = { name: row.v.approvedName, at: row.v.approvedAt, sig: row.v.signatureData };
    else if (row.v.status === "declined") note = "This variation was declined.";
    else form = <SignForm sign={sign} decline={decline} agreeText={`I approve this variation of ${money(row.v.priceCents + gst(row.v.priceCents))} inc GST, to be added to the contract price.`} buttonText="Approve variation" defaultName={row.client?.contactName ?? row.client?.name ?? ""} />;
    body = (
      <>
        <h2 className="text-lg font-semibold">{row.v.title}</h2>
        {row.v.description && <p className="prose-pre mt-3 text-sm text-ink-2">{row.v.description}</p>}
        <Totals ex={row.v.priceCents} gst={gst(row.v.priceCents)} label="Variation price" />
      </>
    );
  } else notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
      <article className="card print-plain p-5 sm:p-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <Logo className="mb-2 w-40" />
            <div className="sr-only">{company.name}</div>
            <div className="text-xs leading-relaxed text-muted">
              {[company.abn && `ABN ${company.abn}`, company.licence && `Lic. ${company.licence}`].filter(Boolean).join(" · ")}
              {company.address && <div>{company.address}</div>}
              {[company.phone, company.email].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold">{title}</div>
            <div className="text-xs text-muted">{fmtDate(new Date().toISOString(), { year: true })}</div>
          </div>
        </header>
        <div className="mb-5 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted">{party.label}</div>
            <div className="font-medium">{party.name ?? "–"}</div>
          </div>
          {siteAddress && (
            <div>
              <div className="text-xs text-muted">Site</div>
              <div className="font-medium">{siteAddress}</div>
            </div>
          )}
        </div>
        {body}
        {signed && (
          <div className="mt-6 flex items-center gap-4 rounded-xl bg-leaf-soft p-4 text-sm text-leaf">
            <CheckCircle2 className="size-6 shrink-0" />
            <div className="flex-1">
              Signed by <b>{signed.name}</b>
              {signed.at ? ` on ${fmtDateTime(signed.at)}` : ""}
            </div>
            {signed.sig && signed.sig.length > 100 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signed.sig} alt="Signature" className="h-12 rounded bg-surface px-2" />
            )}
          </div>
        )}
        {note && <p className="mt-6 rounded-xl bg-subtle p-4 text-sm">{note}</p>}
        {form && <section className="no-print mt-8 border-t border-line pt-6">{form}</section>}
      </article>
      <div className="no-print mt-4 flex justify-center">
        <PrintButton />
      </div>
    </main>
  );
}

function Totals({ ex, gst, label = "Total" }: { ex: number; gst: number; label?: string }) {
  return (
    <div className="mt-6 ml-auto max-w-xs space-y-1 border-t border-line pt-3 text-sm">
      <div className="flex justify-between">
        <span className="text-muted">{label} (ex GST)</span>
        <span className="tabular-nums">{money(ex)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted">GST</span>
        <span className="tabular-nums">{money(gst)}</span>
      </div>
      <div className="flex justify-between text-base font-bold">
        <span>Total inc GST</span>
        <span className="tabular-nums">{money(ex + gst)}</span>
      </div>
    </div>
  );
}

function Terms({ text }: { text: string }) {
  return (
    <section className="mt-6 border-t border-line pt-4">
      <h3 className="mb-1 text-sm font-semibold">Terms</h3>
      <p className="prose-pre text-xs leading-relaxed text-ink-2">{text}</p>
    </section>
  );
}
