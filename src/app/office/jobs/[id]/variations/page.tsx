import { eq } from "drizzle-orm";
import { FilePen, Plus } from "lucide-react";
import { ActionForm, Modal, SubmitButton, Uploader } from "@/components/client";
import { VariationCard, VariationFields } from "@/components/office/variation-card";
import { EmptyState, Stat } from "@/components/ui";
import { variations } from "@/db/schema";
import { createVariation } from "@/lib/actions/variations";
import { requireOffice } from "@/lib/auth";
import { money } from "@/lib/format";
import { getJob } from "@/lib/queries";
import { loadVariations } from "@/lib/variation-data";

export default async function JobVariations({ params }: { params: Promise<{ id: string }> }) {
  await requireOffice();
  const { id } = await params;
  const job = await getJob(Number(id));
  const { rows, smtp, xero } = await loadVariations(eq(variations.jobId, job.id));
  const sum = (st: string[]) => rows.filter((r) => st.includes(r.v.status)).reduce((s, r) => s + r.v.priceCents, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Approved" value={money(sum(["approved", "invoiced"]), true)} />
        <Stat label="With client" value={money(sum(["submitted"]), true)} />
        <Stat label="To price" value={rows.filter((r) => r.v.status === "identified").length} tone={rows.some((r) => r.v.status === "identified") ? "warn" : "default"} />
        <Stat label="Invoiced" value={money(sum(["invoiced"]), true)} />
      </div>
      <div className="flex justify-end">
        <Modal title="New variation" trigger={<><Plus className="size-4" /> Variation</>} triggerClassName="btn btn-primary btn-sm">
          <ActionForm action={createVariation.bind(null, job.id)} success="Variation added">
            <VariationFields />
            <input type="hidden" name="source" value="office" />
            <div className="mt-3">
              <Uploader jobId={job.id} />
            </div>
            <SubmitButton className="btn-primary mt-4 w-full">Add variation</SubmitButton>
          </ActionForm>
        </Modal>
      </div>
      {rows.length === 0 ? (
        <div className="card">
          <EmptyState icon={<FilePen className="size-5" />} title="No variations">
            Variations flagged on site, from client conversations, or added here are tracked from identification to invoice.
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((r) => (
            <VariationCard key={r.v.id} v={r.v} photos={r.photos} identifiedBy={r.identifiedBy} message={r.message} smtp={smtp} xero={xero} />
          ))}
        </div>
      )}
    </div>
  );
}
