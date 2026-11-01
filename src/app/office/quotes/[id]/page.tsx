import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Copy, ExternalLink, Send, Trash2 } from "lucide-react";
import { ActionButton, ActionForm, SubmitButton } from "@/components/client";
import { QuoteEditor } from "@/components/office/quote-editor";
import { SendDialog } from "@/components/send-dialog";
import { PageHeader, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { quoteItems, quotes } from "@/db/schema";
import { createQuote, deleteQuote, saveQuote, setQuoteStatus } from "@/lib/actions/quotes";
import { sendDoc } from "@/lib/actions/send";
import { requireOffice } from "@/lib/auth";
import { QUOTE_STATUSES } from "@/lib/constants";
import { emailEnabled } from "@/lib/email";
import { fmtDateTime } from "@/lib/format";
import { docMessage, shareLink } from "@/lib/messages";
import { getJob, jobStages } from "@/lib/queries";
import { getSetting } from "@/lib/settings";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  await requireOffice();
  const { id } = await params;
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, Number(id)));
  if (!quote) notFound();
  const [job, items, stageRows, rates, message] = await Promise.all([
    getJob(quote.jobId),
    db.select().from(quoteItems).where(eq(quoteItems.quoteId, quote.id)).orderBy(asc(quoteItems.sortOrder)),
    jobStages(quote.jobId),
    getSetting("rates"),
    docMessage("quote", quote.id),
  ]);
  const accepted = quote.status === "accepted";
  const link = shareLink(quote.shareToken);

  return (
    <>
      <PageHeader
        back={`/office/jobs/${job.id}/quotes`}
        title={`Q${quote.id} · ${quote.kind === "estimate" ? "Estimate" : "Quote"}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/office/jobs/${job.id}`} className="font-medium text-ink-2 hover:underline">
              {job.name}
            </Link>
            <StatusBadge map={QUOTE_STATUSES} value={quote.status} />
            {quote.sentAt && <span>Sent {fmtDateTime(quote.sentAt)}</span>}
            {quote.acceptedName && <span>· Accepted by {quote.acceptedName}</span>}
          </span>
        }
        actions={
          <>
            {link && (
              <a href={link} target="_blank" rel="noreferrer" className="btn btn-sm">
                <ExternalLink className="size-4" /> Client view
              </a>
            )}
            {!accepted && message && (
              <SendDialog
                title={`Send ${quote.kind}`}
                trigger={<><Send className="size-4" /> Send</>}
                triggerClassName="btn btn-sm btn-primary"
                message={message}
                smtp={emailEnabled()}
                action={sendDoc.bind(null, "quote", quote.id)}
              />
            )}
          </>
        }
      />

      {accepted && (
        <div className="mb-5 rounded-xl bg-leaf-soft p-4 text-sm text-leaf">
          This quote is accepted. It set the job&apos;s contract value, stage budgets and the site scope of works. To change pricing now, raise a variation.
        </div>
      )}

      <QuoteEditor
        quote={quote}
        items={items}
        sections={stageRows.map((s) => s.name)}
        gstPct={rates.gstPct}
        readOnly={accepted}
        save={saveQuote.bind(null, quote.id)}
      />

      <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
        {!accepted && quote.kind === "quote" && (
          <ActionButton
            action={setQuoteStatus.bind(null, quote.id, "accepted")}
            confirm="Mark as accepted? This sets the contract value, stage budgets and the site scope from this quote. Save any changes first."
            className="btn-sm"
            success="Quote accepted – job moved to Won"
          >
            Mark accepted
          </ActionButton>
        )}
        {quote.status === "sent" && (
          <ActionButton action={setQuoteStatus.bind(null, quote.id, "declined")} className="btn-sm" success="Marked declined">
            Mark declined
          </ActionButton>
        )}
        {quote.status !== "draft" && !accepted && (
          <ActionButton action={setQuoteStatus.bind(null, quote.id, "draft")} className="btn-sm">
            Back to draft
          </ActionButton>
        )}
        <ActionForm action={createQuote.bind(null, job.id)}>
          <input type="hidden" name="kind" value="quote" />
          <input type="hidden" name="copyFrom" value={quote.id} />
          <SubmitButton className="btn-sm">
            <Copy className="size-4" /> {quote.kind === "estimate" ? "Turn into quote" : "Duplicate"}
          </SubmitButton>
        </ActionForm>
        <div className="flex-1" />
        <ActionButton action={deleteQuote.bind(null, quote.id)} confirm="Delete this quote?" className="btn-sm btn-ghost btn-danger">
          <Trash2 className="size-4" /> Delete
        </ActionButton>
      </div>
    </>
  );
}
