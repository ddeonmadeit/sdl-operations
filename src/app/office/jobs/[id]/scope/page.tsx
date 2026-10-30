import { asc, eq } from "drizzle-orm";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ActionButton, ActionForm, CheckRow, Modal, SubmitButton } from "@/components/client";
import { Card, EmptyState, ProgressBar, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { scopeItems, users } from "@/db/schema";
import { addScopeItems, deleteScopeItem, toggleScopeItem, updateScopeItem } from "@/lib/actions/jobs";
import { requireOffice } from "@/lib/auth";
import { STAGE_STATUSES } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { getJob, jobStages } from "@/lib/queries";

export default async function ScopePage({ params }: { params: Promise<{ id: string }> }) {
  await requireOffice();
  const { id } = await params;
  const job = await getJob(Number(id));
  const [stageRows, items] = await Promise.all([
    jobStages(job.id),
    db
      .select({ item: scopeItems, doneBy: users.name })
      .from(scopeItems)
      .leftJoin(users, eq(users.id, scopeItems.doneById))
      .where(eq(scopeItems.jobId, job.id))
      .orderBy(asc(scopeItems.sortOrder), asc(scopeItems.id)),
  ]);

  const groups = [
    ...stageRows.map((s) => ({ stage: s, items: items.filter((i) => i.item.stageId === s.id) })),
    { stage: null, items: items.filter((i) => !i.item.stageId || !stageRows.some((s) => s.id === i.item.stageId)) },
  ].filter((g) => g.stage || g.items.length);

  const addForm = (stageId?: number) => (
    <ActionForm action={addScopeItems.bind(null, job.id)} success="Scope updated">
      <div className="space-y-3">
        <label className="block">
          <span className="label">Stage</span>
          <select name="stageId" defaultValue={stageId ?? ""} className="input">
            <option value="">General</option>
            {stageRows.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Scope items</span>
          <textarea name="description" rows={6} required className="input" placeholder={"One item per line, e.g.\nExcavate pool shell\nRemove spoil from site"} autoFocus />
          <span className="hint block">Paste a whole list – each line becomes a tick-box item on site.</span>
        </label>
      </div>
      <SubmitButton className="btn-primary mt-4 w-full">Add to scope</SubmitButton>
    </ActionForm>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          The scope supervisors see and tick off on site. Accepting a quote fills this in automatically.
        </p>
        <Modal title="Add scope items" trigger={<><Plus className="size-4" /> Add items</>} triggerClassName="btn btn-primary btn-sm">
          {addForm()}
        </Modal>
      </div>
      {items.length === 0 && (
        <div className="card">
          <EmptyState title="No scope of works yet">Add items, or accept a quote to generate the scope from its line items.</EmptyState>
        </div>
      )}
      {groups.map(({ stage, items: list }) => {
        const done = list.filter((i) => i.item.doneAt).length;
        return (
          <Card
            key={stage?.id ?? "general"}
            pad={false}
            title={
              <span className="flex items-center gap-2">
                {stage?.name ?? "General"}
                {stage && stage.status !== "not_started" && <StatusBadge map={STAGE_STATUSES} value={stage.status} />}
              </span>
            }
            action={
              <div className="flex items-center gap-3">
                {list.length > 0 && (
                  <span className="text-xs text-muted tabular-nums">
                    {done}/{list.length}
                  </span>
                )}
                <Modal title={`Add to ${stage?.name ?? "General"}`} trigger={<Plus className="size-4" />} triggerClassName="btn btn-ghost btn-icon btn-sm" triggerTitle="Add items">
                  {addForm(stage?.id)}
                </Modal>
              </div>
            }
          >
            {list.length > 0 && <ProgressBar value={(done / list.length) * 100} className="rounded-none" />}
            {list.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">No items yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {list.map(({ item, doneBy }) => (
                  <li key={item.id} className="flex items-center">
                    <div className="min-w-0 flex-1">
                      <CheckRow checked={!!item.doneAt} action={toggleScopeItem.bind(null, item.id)}>
                        {item.description}
                        {item.doneAt && (
                          <span className="block text-xs text-muted no-underline">
                            Done by {doneBy ?? "?"} · {timeAgo(item.doneAt)}
                          </span>
                        )}
                      </CheckRow>
                    </div>
                    <Modal title="Edit scope item" trigger={<Pencil className="size-3.5" />} triggerClassName="btn btn-ghost btn-icon btn-sm mr-2" triggerTitle="Edit">
                      <ActionForm action={updateScopeItem.bind(null, item.id)} success="Saved" reset={false}>
                        <div className="space-y-3">
                          <textarea name="description" defaultValue={item.description} rows={3} className="input" required />
                          <select name="stageId" defaultValue={item.stageId ?? ""} className="input">
                            <option value="">General</option>
                            {stageRows.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <SubmitButton className="btn-primary mt-4 w-full">Save</SubmitButton>
                      </ActionForm>
                      <ActionButton action={deleteScopeItem.bind(null, item.id)} confirm="Delete this scope item?" className="btn-ghost btn-danger mt-2 w-full">
                        <Trash2 className="size-4" /> Delete
                      </ActionButton>
                    </Modal>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
