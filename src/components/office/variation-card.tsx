import Link from "next/link";
import { Pencil } from "lucide-react";
import { ActionButton, ActionForm, Modal, SubmitButton } from "@/components/client";
import { SendDialog } from "@/components/send-dialog";
import { PhotoGrid } from "@/components/shared";
import { cx, StatusBadge } from "@/components/ui";
import type { Variation } from "@/db/schema";
import { deleteVariation, invoiceVariation, setVariationStatus, updateVariation } from "@/lib/actions/variations";
import { sendDoc } from "@/lib/actions/send";
import { VARIATION_STATUSES } from "@/lib/constants";
import { centsToInput, money, timeAgo } from "@/lib/format";
import type { DocMessage } from "@/lib/messages";

const STEPS = ["identified", "priced", "submitted", "approved", "invoiced"] as const;

export function VariationFields({ v, office = true }: { v?: Variation; office?: boolean }) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="label">Title</span>
        <input name="title" required defaultValue={v?.title} className="input" placeholder="e.g. Relocate stormwater pipe" />
      </label>
      <label className="block">
        <span className="label">Description</span>
        <textarea name="description" rows={4} defaultValue={v?.description ?? ""} className="input" placeholder="What changed, why, and what's needed" />
      </label>
      {office && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Our cost ($)</span>
            <input name="cost" inputMode="decimal" defaultValue={centsToInput(v?.costCents)} className="input" placeholder="0" />
          </label>
          <label className="block">
            <span className="label">Price to client ($ ex GST)</span>
            <input name="price" inputMode="decimal" defaultValue={centsToInput(v?.priceCents)} className="input" placeholder="0" />
          </label>
        </div>
      )}
    </div>
  );
}

export function VariationCard({
  v,
  job,
  photos,
  identifiedBy,
  message,
  smtp,
  xero,
}: {
  v: Variation;
  job?: { id: number; name: string };
  photos: { id: number; name: string; mimeType: string }[];
  identifiedBy: string | null;
  message: DocMessage | null;
  smtp: boolean;
  xero: boolean;
}) {
  const stepIdx = STEPS.indexOf(v.status as (typeof STEPS)[number]);
  const margin = v.priceCents - v.costCents;
  return (
    <article className="card overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold">
              V{v.number} · {v.title}
            </div>
            <div className="mt-0.5 text-xs text-muted">
              {job && (
                <>
                  <Link href={`/office/jobs/${job.id}/variations`} className="font-medium text-ink-2 hover:underline">
                    {job.name}
                  </Link>
                  {" · "}
                </>
              )}
              From {v.source} · {identifiedBy ?? "office"} · {timeAgo(v.createdAt)}
            </div>
          </div>
          <StatusBadge map={VARIATION_STATUSES} value={v.status} />
        </div>
        {v.description && <p className="prose-pre mt-2 text-sm text-ink-2">{v.description}</p>}
        <PhotoGrid files={photos} className="mt-3" />

        {v.status !== "declined" && (
          <ol className="mt-4 flex items-center gap-1">
            {STEPS.map((s, i) => (
              <li key={s} className="flex flex-1 flex-col gap-1">
                <span className={cx("h-1 rounded-full", i <= stepIdx ? "bg-accent" : "bg-subtle")} />
                <span className={cx("hidden text-[0.65rem] font-medium sm:block", i <= stepIdx ? "text-ink-2" : "text-muted")}>
                  {VARIATION_STATUSES[s].label}
                </span>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <span>
            <span className="text-muted">Price </span>
            <b className="tabular-nums">{v.priceCents ? money(v.priceCents) : "–"}</b>
          </span>
          <span>
            <span className="text-muted">Cost </span>
            <span className="tabular-nums">{v.costCents ? money(v.costCents) : "–"}</span>
          </span>
          {v.priceCents > 0 && (
            <span className={margin < 0 ? "text-clay" : "text-leaf"}>
              <span className="text-muted">Margin </span>
              <span className="tabular-nums">{money(margin)}</span>
            </span>
          )}
          {v.approvedName && <span className="text-muted">Approved by {v.approvedName}</span>}
          {v.invoiceRef && <span className="text-muted">Invoice {v.invoiceRef}</span>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-subtle/50 px-4 py-2.5">
        {v.status === "identified" && (
          <Modal title={`Price V${v.number}`} trigger="Price it" triggerClassName="btn btn-sm btn-primary">
            <ActionForm action={updateVariation.bind(null, v.id)} reset={false} success="Variation priced">
              <VariationFields v={v} />
              <SubmitButton className="btn-primary mt-4 w-full">Save price</SubmitButton>
            </ActionForm>
          </Modal>
        )}
        {(v.status === "priced" || v.status === "submitted") && message && (
          <SendDialog
            title={`Send V${v.number} to client for approval`}
            trigger={v.status === "submitted" ? "Resend" : "Send to client"}
            triggerClassName={cx("btn btn-sm", v.status === "priced" && "btn-primary")}
            message={message}
            smtp={smtp}
            action={sendDoc.bind(null, "variation", v.id)}
          />
        )}
        {(v.status === "priced" || v.status === "submitted") && (
          <ActionButton action={setVariationStatus.bind(null, v.id, "approved")} confirm="Record client approval (e.g. by email or in person)?" className="btn-sm" success="Approved">
            Mark approved
          </ActionButton>
        )}
        {v.status === "submitted" && (
          <ActionButton action={setVariationStatus.bind(null, v.id, "declined")} className="btn-sm" success="Declined">
            Declined
          </ActionButton>
        )}
        {v.status === "approved" && (
          <Modal title={`Invoice V${v.number}`} trigger="Invoice" triggerClassName="btn btn-sm btn-primary">
            <p className="mb-3 text-sm text-muted">
              {money(v.priceCents)} ex GST to the client.{" "}
              {xero ? "Create a draft invoice in Xero, or record an invoice number you raised elsewhere." : "Record the invoice number. Connect Xero in Settings to create invoices automatically."}
            </p>
            {xero && (
              <ActionForm action={invoiceVariation.bind(null, v.id)} className="mb-3">
                <input type="hidden" name="mode" value="xero" />
                <SubmitButton className="btn-primary w-full">Create draft invoice in Xero</SubmitButton>
              </ActionForm>
            )}
            <ActionForm action={invoiceVariation.bind(null, v.id)}>
              <input type="hidden" name="mode" value="manual" />
              <label className="block">
                <span className="label">Invoice number</span>
                <input name="invoiceRef" className="input" placeholder="e.g. INV-1042" />
              </label>
              <SubmitButton className="mt-3 w-full btn">Mark as invoiced</SubmitButton>
            </ActionForm>
          </Modal>
        )}
        {v.status === "declined" && (
          <ActionButton action={setVariationStatus.bind(null, v.id, "priced")} className="btn-sm">
            Reopen
          </ActionButton>
        )}
        <div className="flex-1" />
        <Modal title={`Edit V${v.number}`} trigger={<Pencil className="size-4" />} triggerClassName="btn btn-ghost btn-icon btn-sm" triggerTitle="Edit">
          <ActionForm action={updateVariation.bind(null, v.id)} reset={false} success="Saved">
            <VariationFields v={v} />
            <SubmitButton className="btn-primary mt-4 w-full">Save</SubmitButton>
          </ActionForm>
          <ActionButton action={deleteVariation.bind(null, v.id)} confirm="Delete this variation?" className="btn-ghost btn-danger mt-2 w-full">
            Delete variation
          </ActionButton>
        </Modal>
      </div>
    </article>
  );
}
