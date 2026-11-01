import { ActionForm, DraftKeeper, SubmitButton, Uploader } from "@/components/client";
import { addEntry } from "@/lib/actions/site";
import { ENTRY_TYPES, type EntryType } from "@/lib/constants";

/** Add a note / client conversation / issue / unforeseen item / photos – with optional variation flag and follow-up task. */
export function NoteForm({
  jobId,
  users,
  currentUserId,
  defaultType = "note",
  types = ["note", "client", "issue", "unforeseen", "photo"],
  then,
}: {
  jobId: number;
  users: { id: number; name: string }[];
  currentUserId: number;
  defaultType?: EntryType;
  types?: EntryType[];
  then?: string;
}) {
  return (
    <ActionForm action={addEntry.bind(null, jobId)} success="Saved" then={then}>
      <DraftKeeper storageKey={`note-${jobId}`} />
      <div className="space-y-4">
        <fieldset className={types.length === 1 ? "hidden" : undefined}>
          <span className="label">Type</span>
          <div className="flex flex-wrap gap-1.5">
            {types.map((t) => (
              <label
                key={t}
                className="cursor-pointer rounded-full border border-line-strong px-3 py-1.5 text-sm font-medium has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-cream"
              >
                <input type="radio" name="type" value={t} defaultChecked={t === defaultType} className="sr-only" />
                {ENTRY_TYPES[t].label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="label">Details</span>
          <textarea name="body" rows={4} className="input" placeholder="What happened / what was discussed?" />
        </label>
        <Uploader jobId={jobId} />
        <label className="flex items-start gap-3 rounded-xl border border-line px-3 py-3">
          <input type="checkbox" name="flagVariation" className="mt-0.5 size-5 accent-[var(--color-accent)]" />
          <span className="text-sm">
            <span className="font-semibold">Potential variation</span>
            <span className="block text-muted">Sends it to the office to price and get client approval.</span>
          </span>
        </label>
        <details className="rounded-xl border border-line px-3 py-2.5">
          <summary className="text-sm font-semibold">Add a follow-up task</summary>
          <div className="mt-3 space-y-3">
            <input name="taskTitle" className="input" placeholder="What needs to happen next?" />
            <div className="grid grid-cols-2 gap-3">
              <select name="taskAssigneeId" defaultValue={currentUserId} className="input" aria-label="Responsible">
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.id === currentUserId ? `${u.name} (me)` : u.name}
                  </option>
                ))}
              </select>
              <input name="taskDueDate" type="date" className="input" aria-label="Due date" />
            </div>
          </div>
        </details>
      </div>
      <SubmitButton className="btn-primary btn-lg mt-5 w-full">Save</SubmitButton>
    </ActionForm>
  );
}
