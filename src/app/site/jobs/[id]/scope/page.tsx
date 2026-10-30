import { asc, eq } from "drizzle-orm";
import { ActionButton, CheckRow } from "@/components/client";
import { SiteHeader } from "@/components/site/site-ui";
import { EmptyState, ProgressBar, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { scopeItems } from "@/db/schema";
import { setStageStatus, toggleScopeItem } from "@/lib/actions/jobs";
import { requireUser } from "@/lib/auth";
import { STAGE_STATUSES } from "@/lib/constants";
import { getJob, jobStages } from "@/lib/queries";

export const metadata = { title: "Scope of works" };

export default async function SiteScope({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const job = await getJob(Number(id));
  const [stageRows, items] = await Promise.all([
    jobStages(job.id),
    db.select().from(scopeItems).where(eq(scopeItems.jobId, job.id)).orderBy(asc(scopeItems.sortOrder), asc(scopeItems.id)),
  ]);
  const general = items.filter((i) => !i.stageId);

  return (
    <>
      <SiteHeader back={`/site/jobs/${job.id}`} title="Scope of works" sub={job.name} />
      {items.length === 0 && (
        <div className="card">
          <EmptyState title="No scope yet">The office adds the scope of works when the quote is accepted.</EmptyState>
        </div>
      )}
      <div className="space-y-4">
        {stageRows.map((s) => {
          const list = items.filter((i) => i.stageId === s.id);
          if (!list.length && s.status === "not_started") return null;
          const done = list.filter((i) => i.doneAt).length;
          return (
            <details key={s.id} open={s.status === "in_progress" || s.status === "complete"} className="card group overflow-hidden">
              <summary className="flex list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-xs text-muted">
                    {s.contact?.name ?? (s.kind === "sdl" ? "SDL + KPR" : "")} {list.length ? `· ${done}/${list.length}` : ""}
                  </div>
                </div>
                <StatusBadge map={STAGE_STATUSES} value={s.status} />
              </summary>
              {list.length > 0 && <ProgressBar value={(done / list.length) * 100} className="rounded-none" />}
              <div className="divide-y divide-line border-t border-line">
                {list.map((i) => (
                  <CheckRow key={i.id} checked={!!i.doneAt} action={toggleScopeItem.bind(null, i.id)}>
                    {i.description}
                  </CheckRow>
                ))}
              </div>
              {s.status === "in_progress" && (
                <div className="border-t border-line p-3">
                  <ActionButton
                    action={setStageStatus.bind(null, s.id, "complete")}
                    confirm={`Mark ${s.name} complete? The office will check it before paying.`}
                    className="btn-primary w-full"
                    success="Sent to the office to check"
                  >
                    Mark {s.name} complete
                  </ActionButton>
                </div>
              )}
              {s.status === "not_started" && list.length > 0 && (
                <div className="border-t border-line p-3">
                  <ActionButton action={setStageStatus.bind(null, s.id, "in_progress")} className="w-full" success="Stage started">
                    Start {s.name}
                  </ActionButton>
                </div>
              )}
            </details>
          );
        })}
        {general.length > 0 && (
          <div className="card divide-y divide-line">
            <div className="px-4 py-3 font-semibold">General</div>
            {general.map((i) => (
              <CheckRow key={i.id} checked={!!i.doneAt} action={toggleScopeItem.bind(null, i.id)}>
                {i.description}
              </CheckRow>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
