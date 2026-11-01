import { ActionForm, DraftKeeper, SubmitButton, Uploader } from "@/components/client";
import { SiteHeader } from "@/components/site/site-ui";
import { createVariation } from "@/lib/actions/variations";
import { requireUser } from "@/lib/auth";
import { getJob } from "@/lib/queries";

export const metadata = { title: "Potential variation" };

export default async function SiteVariation({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const job = await getJob(Number(id));
  return (
    <>
      <SiteHeader back={`/site/jobs/${job.id}`} title="Potential variation" sub={job.name} />
      <p className="mb-4 text-sm text-muted">Anything outside the scope – client requests or site conditions. The office prices it and gets client approval before the work goes ahead.</p>
      <div className="card p-4">
        <ActionForm action={createVariation.bind(null, job.id)} then={`/site/jobs/${job.id}`}>
          <DraftKeeper storageKey={`variation-${job.id}`} />
          <div className="space-y-4">
            <fieldset>
              <span className="label">Where did it come from?</span>
              <div className="flex gap-2">
                {[
                  ["client", "Client asked"],
                  ["site", "Site condition"],
                ].map(([v, l]) => (
                  <label key={v} className="flex flex-1 cursor-pointer items-center justify-center rounded-xl border border-line-strong py-2.5 text-sm font-medium has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-cream">
                    <input type="radio" name="source" value={v} defaultChecked={v === "client"} className="sr-only" />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="label">Short title</span>
              <input name="title" required className="input" placeholder="e.g. Extra garden lights" />
            </label>
            <label className="block">
              <span className="label">Details</span>
              <textarea name="description" rows={4} className="input" placeholder="What's needed, quantities, what the client said…" />
            </label>
            <Uploader jobId={job.id} />
          </div>
          <SubmitButton className="btn-primary btn-lg mt-5 w-full">Send to office</SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}
