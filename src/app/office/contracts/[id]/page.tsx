import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ExternalLink, Send, Trash2 } from "lucide-react";
import { ActionButton, ActionForm, SubmitButton } from "@/components/client";
import { SendDialog } from "@/components/send-dialog";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { contracts } from "@/db/schema";
import { deleteContract, setContractStatus, updateContract } from "@/lib/actions/contracts";
import { sendDoc } from "@/lib/actions/send";
import { requireOffice } from "@/lib/auth";
import { CONTRACT_STATUSES } from "@/lib/constants";
import { emailEnabled } from "@/lib/email";
import { centsToInput, fmtDateTime } from "@/lib/format";
import { docMessage, shareLink } from "@/lib/messages";
import { contactOptions, getJob, jobStages } from "@/lib/queries";

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOffice();
  const { id } = await params;
  const [c] = await db.select().from(contracts).where(eq(contracts.id, Number(id)));
  if (!c) notFound();
  const sub = c.kind === "subcontract";
  const [job, people, stageRows, message] = await Promise.all([
    getJob(c.jobId),
    contactOptions(sub ? ["subcontractor"] : ["client"]),
    jobStages(c.jobId),
    docMessage("contract", c.id),
  ]);
  const signed = c.status === "signed";
  const link = shareLink(c.shareToken);

  return (
    <>
      <PageHeader
        back={`/office/jobs/${job.id}/quotes`}
        title={sub ? "Subcontract agreement" : "Client contract"}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/office/jobs/${job.id}`} className="font-medium text-ink-2 hover:underline">
              {job.name}
            </Link>
            <StatusBadge map={CONTRACT_STATUSES} value={c.status} />
            {c.sentAt && <span>Sent {fmtDateTime(c.sentAt)}</span>}
          </span>
        }
        actions={
          <>
            {link && c.status !== "draft" && (
              <a href={link} target="_blank" rel="noreferrer" className="btn btn-sm">
                <ExternalLink className="size-4" /> Signing page
              </a>
            )}
            {!signed && c.status !== "cancelled" && message && (
              <SendDialog
                title={sub ? "Send agreement to subcontractor" : "Send contract to client"}
                trigger={<><Send className="size-4" /> {c.status === "sent" ? "Resend" : "Send for signing"}</>}
                triggerClassName="btn btn-sm btn-primary"
                message={message}
                smtp={emailEnabled()}
                action={sendDoc.bind(null, "contract", c.id)}
              />
            )}
          </>
        }
      />

      {signed && (
        <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl bg-green-50 p-4 text-sm text-green-900">
          <div className="flex-1">
            Signed{c.signedName ? ` by ${c.signedName}` : ""} {c.signedAt ? `on ${fmtDateTime(c.signedAt)}` : ""}.
          </div>
          {c.signatureData && c.signatureData.length > 100 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.signatureData} alt="Signature" className="h-14 rounded bg-white px-2" />
          )}
        </div>
      )}

      <ActionForm action={updateContract.bind(null, c.id)} reset={false}>
        <fieldset disabled={signed} className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <Card>
              <div className="space-y-3">
                <label className="block">
                  <span className="label">Title</span>
                  <input name="title" defaultValue={c.title} className="input" />
                </label>
                <label className="block">
                  <span className="label">Scope of works</span>
                  <textarea name="scope" defaultValue={c.scope ?? ""} rows={8} className="input text-sm" />
                </label>
                <label className="block">
                  <span className="label">Terms</span>
                  <textarea name="terms" defaultValue={c.terms ?? ""} rows={14} className="input text-sm" />
                  <span className="hint block">Default terms come from Settings → Templates.</span>
                </label>
              </div>
            </Card>
          </div>
          <div className="space-y-5">
            <Card>
              <div className="space-y-3">
                <label className="block">
                  <span className="label">{sub ? "Subcontractor" : "Client"}</span>
                  <select name="contactId" defaultValue={c.contactId ?? ""} className="input">
                    <option value="">–</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                {sub && (
                  <label className="block">
                    <span className="label">Stage</span>
                    <select name="stageId" defaultValue={c.stageId ?? ""} className="input">
                      <option value="">–</option>
                      {stageRows.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="block">
                  <span className="label">{sub ? "Agreed price ($ ex GST)" : "Contract price ($ ex GST)"}</span>
                  <input name="amount" inputMode="decimal" defaultValue={centsToInput(c.amountCents)} className="input" />
                </label>
                {!signed && <SubmitButton className="btn-primary w-full">Save</SubmitButton>}
              </div>
            </Card>
          </div>
        </fieldset>
      </ActionForm>

      <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
        {!signed && c.status !== "cancelled" && (
          <ActionButton action={setContractStatus.bind(null, c.id, "signed")} confirm="Mark as signed (e.g. signed on paper)?" className="btn-sm">
            Mark signed on paper
          </ActionButton>
        )}
        {c.status !== "cancelled" && (
          <ActionButton action={setContractStatus.bind(null, c.id, "cancelled")} confirm="Cancel this? The signing link will stop working." className="btn-sm">
            Cancel
          </ActionButton>
        )}
        {c.status === "cancelled" && (
          <ActionButton action={setContractStatus.bind(null, c.id, "draft")} className="btn-sm">
            Restore to draft
          </ActionButton>
        )}
        <div className="flex-1" />
        <ActionButton action={deleteContract.bind(null, c.id)} confirm="Delete permanently?" className="btn-sm btn-ghost btn-danger">
          <Trash2 className="size-4" /> Delete
        </ActionButton>
      </div>
    </>
  );
}
