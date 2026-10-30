import { inArray } from "drizzle-orm";
import { FilePen } from "lucide-react";
import { VariationCard } from "@/components/office/variation-card";
import { EmptyState, PageHeader, Tabs } from "@/components/ui";
import { variations } from "@/db/schema";
import { requireOffice } from "@/lib/auth";
import { loadVariations } from "@/lib/variation-data";

export const metadata = { title: "Variations" };

const VIEWS = {
  open: { label: "To action", statuses: ["identified", "priced", "submitted", "approved"] },
  done: { label: "Invoiced", statuses: ["invoiced"] },
  declined: { label: "Declined", statuses: ["declined"] },
};

export default async function VariationsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireOffice();
  const { view: v } = await searchParams;
  const view = (v && v in VIEWS ? v : "open") as keyof typeof VIEWS;
  const { rows, smtp, xero } = await loadVariations(inArray(variations.status, VIEWS[view].statuses));
  const order = VIEWS[view].statuses;
  rows.sort((a, b) => order.indexOf(a.v.status) - order.indexOf(b.v.status));

  return (
    <>
      <PageHeader title="Variations" subtitle="From site or client, through pricing and approval, to invoice" />
      <Tabs current={`/office/variations?view=${view}`} tabs={Object.entries(VIEWS).map(([k, d]) => ({ href: `/office/variations?view=${k}`, label: d.label }))} />
      {rows.length === 0 ? (
        <div className="card">
          <EmptyState icon={<FilePen className="size-5" />} title="Nothing here" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((r) => (
            <VariationCard key={r.v.id} v={r.v} job={r.job} photos={r.photos} identifiedBy={r.identifiedBy} message={r.message} smtp={smtp} xero={xero} />
          ))}
        </div>
      )}
    </>
  );
}
