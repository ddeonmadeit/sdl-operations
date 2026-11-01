import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Camera, ClipboardList, HardHat, MessageSquare, Pencil, StickyNote, Trash2 } from "lucide-react";
import { createTask, deleteTask, toggleTask, updateTask } from "@/lib/actions/tasks";
import { ENTRY_TYPES } from "@/lib/constants";
import { fmtDateTime, relDay, timeAgo, today } from "@/lib/format";
import { ActionButton, ActionForm, CheckRow, Modal, SubmitButton } from "./client";
import { Avatar, Badge, cx, EmptyState } from "./ui";

/* ───────────── Tasks ───────────── */

export type TaskRow = {
  id: number;
  title: string;
  notes: string | null;
  status: string;
  dueDate: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
  jobId: number | null;
  jobName: string | null;
};

type UserOpt = { id: number; name: string };
type JobOpt = { id: number; name: string };

export function TaskFields({
  users,
  jobs,
  defaults,
  jobId,
  currentUserId,
}: {
  users: UserOpt[];
  jobs?: JobOpt[];
  defaults?: Partial<TaskRow>;
  jobId?: number;
  currentUserId: number;
}) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="label">What needs doing?</span>
        <input name="title" required defaultValue={defaults?.title} className="input" placeholder="e.g. Order pool coping" autoFocus={!defaults} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Responsible</span>
          <select name="assigneeId" defaultValue={defaults?.assigneeId ?? currentUserId} className="input">
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.id === currentUserId ? `${u.name} (me)` : u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Due</span>
          <input name="dueDate" type="date" defaultValue={defaults?.dueDate ?? ""} className="input" />
        </label>
      </div>
      {jobId ? (
        <input type="hidden" name="jobId" value={jobId} />
      ) : jobs ? (
        <label className="block">
          <span className="label">Job (optional)</span>
          <select name="jobId" defaultValue={defaults?.jobId ?? ""} className="input">
            <option value="">– Not job specific –</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="block">
        <span className="label">Notes</span>
        <textarea name="notes" rows={2} defaultValue={defaults?.notes ?? ""} className="input" />
      </label>
    </div>
  );
}

export function AddTaskButton(props: {
  users: UserOpt[];
  jobs?: JobOpt[];
  jobId?: number;
  currentUserId: number;
  className?: string;
  label?: string;
}) {
  return (
    <Modal title="New task" trigger={<>+ {props.label ?? "Task"}</>} triggerClassName={props.className ?? "btn btn-sm"}>
      <ActionForm action={createTask} success="Task added">
        <TaskFields {...props} />
        <SubmitButton className="btn-primary mt-4 w-full">Add task</SubmitButton>
      </ActionForm>
    </Modal>
  );
}

export function TaskList({
  tasks,
  users,
  jobs,
  currentUserId,
  showJob = true,
  jobHref = (id) => `/office/jobs/${id}`,
  empty = "Nothing to do – nice.",
}: {
  tasks: TaskRow[];
  users: UserOpt[];
  jobs?: JobOpt[];
  currentUserId: number;
  showJob?: boolean;
  jobHref?: (id: number) => string;
  empty?: string;
}) {
  if (!tasks.length) return <p className="px-4 py-6 text-center text-sm text-muted">{empty}</p>;
  const t0 = today();
  return (
    <ul className="divide-y divide-line">
      {tasks.map((t) => {
        const overdue = t.status !== "done" && t.dueDate && t.dueDate < t0;
        return (
          <li key={t.id} className="flex items-start">
            <div className="min-w-0 flex-1">
              <CheckRow checked={t.status === "done"} action={toggleTask.bind(null, t.id)}>
                <span className="font-medium">{t.title}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted no-underline">
                  {t.assigneeName && (
                    <span className="inline-flex items-center gap-1">
                      <Avatar name={t.assigneeName} size="sm" />
                      {t.assigneeId === currentUserId ? "Me" : t.assigneeName}
                    </span>
                  )}
                  {t.dueDate && <span className={cx(overdue && "font-semibold text-clay")}>{overdue ? "Overdue · " : "Due "}{relDay(t.dueDate)}</span>}
                  {showJob && t.jobName && <span className="truncate">· {t.jobName}</span>}
                </span>
              </CheckRow>
            </div>
            <div className="flex shrink-0 items-center gap-1 py-2.5 pr-2">
              {showJob && t.jobId && (
                <Link href={jobHref(t.jobId)} className="btn btn-ghost btn-icon btn-sm" title="Open job" aria-label="Open job">
                  <ArrowUpRight className="size-4" />
                </Link>
              )}
              <Modal title="Edit task" trigger={<Pencil className="size-4" />} triggerClassName="btn btn-ghost btn-icon btn-sm" triggerTitle="Edit task">
                <ActionForm action={updateTask.bind(null, t.id)} success="Task updated" reset={false}>
                  <TaskFields users={users} jobs={jobs} defaults={t} jobId={jobs ? undefined : (t.jobId ?? undefined)} currentUserId={currentUserId} />
                  <div className="mt-4 flex gap-2">
                    <SubmitButton className="btn-primary flex-1">Save</SubmitButton>
                  </div>
                </ActionForm>
                <div className="mt-2">
                  <ActionButton action={deleteTask.bind(null, t.id)} confirm="Delete this task?" className="btn-ghost btn-danger w-full">
                    <Trash2 className="size-4" /> Delete task
                  </ActionButton>
                </div>
              </Modal>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ───────────── Photos ───────────── */

export function PhotoGrid({ files, className }: { files: { id: number; name: string; mimeType: string }[]; className?: string }) {
  const imgs = files.filter((f) => f.mimeType.startsWith("image/"));
  const docs = files.filter((f) => !f.mimeType.startsWith("image/"));
  if (!files.length) return null;
  return (
    <div className={className}>
      {imgs.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {imgs.map((f) => (
            <a key={f.id} href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-lg bg-subtle">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/files/${f.id}`} alt={f.name} loading="lazy" className="size-full object-cover transition hover:scale-105" />
            </a>
          ))}
        </div>
      )}
      {docs.length > 0 && (
        <ul className="mt-2 space-y-1">
          {docs.map((f) => (
            <li key={f.id}>
              <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="text-sm font-medium text-accent underline-offset-2 hover:underline">
                {f.name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ───────────── Activity feed ───────────── */

export function ActivityFeed({
  items,
  showJob,
}: {
  items: { id: number; message: string; createdAt: Date; user: string | null; jobId?: number | null; jobName?: string | null }[];
  showJob?: boolean;
}) {
  if (!items.length) return <EmptyState title="No activity yet" />;
  return (
    <ol className="relative space-y-4 pl-5 before:absolute before:top-1 before:bottom-1 before:left-[5px] before:w-px before:bg-line">
      {items.map((a) => (
        <li key={a.id} className="relative">
          <span className="absolute top-1.5 -left-5 size-[11px] rounded-full border-2 border-surface bg-line-strong" />
          <div className="text-sm">{a.message}</div>
          <div className="mt-0.5 text-xs text-muted">
            {a.user ?? "Client / system"} · <span title={fmtDateTime(a.createdAt)}>{timeAgo(a.createdAt)}</span>
            {showJob && a.jobId && a.jobName && (
              <>
                {" · "}
                <Link href={`/office/jobs/${a.jobId}`} className="font-medium text-ink-2 hover:underline">
                  {a.jobName}
                </Link>
              </>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ───────────── Diary entry ───────────── */

export const ENTRY_ICONS = {
  note: StickyNote,
  client: MessageSquare,
  issue: AlertTriangle,
  unforeseen: AlertTriangle,
  photo: Camera,
  log: ClipboardList,
  induction: HardHat,
} as const;

export function EntryTypeBadge({ type }: { type: string }) {
  const def = ENTRY_TYPES[type as keyof typeof ENTRY_TYPES];
  return def ? <Badge tone={def.tone}>{def.label}</Badge> : null;
}
