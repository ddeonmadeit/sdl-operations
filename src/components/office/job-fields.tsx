import { JOB_SOURCES } from "@/lib/constants";
import { centsToInput } from "@/lib/format";
import type { Job } from "@/db/schema";

type Opt = { id: number; name: string };

/** Fields shared by "New enquiry" and "Edit job". */
export function JobFields({
  clients,
  supervisors,
  job,
  isNew,
}: {
  clients: Opt[];
  supervisors: Opt[];
  job?: Job;
  isNew?: boolean;
}) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="label">Job name</span>
        <input name="name" required defaultValue={job?.name} className="input" placeholder="e.g. Smith – Pool & backyard" autoFocus={isNew} />
      </label>
      <label className="block">
        <span className="label">Client</span>
        <select name="clientId" defaultValue={job?.clientId ?? ""} className="input">
          <option value="">{isNew ? "– New client (enter below) –" : "– None –"}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {isNew && (
        <div className="grid gap-3 rounded-xl bg-subtle p-3 sm:grid-cols-3">
          <input name="newClientName" className="input" placeholder="New client name" />
          <input name="newClientPhone" className="input" placeholder="Phone" inputMode="tel" />
          <input name="newClientEmail" className="input" placeholder="Email" type="email" />
        </div>
      )}
      <label className="block">
        <span className="label">Site address</span>
        <input name="siteAddress" defaultValue={job?.siteAddress ?? ""} className="input" autoComplete="street-address" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Source</span>
          <select name="source" defaultValue={job?.source ?? ""} className="input">
            <option value="">–</option>
            {JOB_SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Estimated value ($)</span>
          <input name="estimatedValue" inputMode="decimal" defaultValue={centsToInput(job?.estimatedValueCents)} className="input" placeholder="0" />
        </label>
      </div>
      {!isNew && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Contract value ($ ex GST)</span>
            <input name="contractValue" inputMode="decimal" defaultValue={centsToInput(job?.contractValueCents)} className="input" />
          </label>
          <label className="block">
            <span className="label">Supervisor</span>
            <select name="supervisorId" defaultValue={job?.supervisorId ?? ""} className="input">
              <option value="">– Unassigned –</option>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Start date</span>
            <input name="startDate" type="date" defaultValue={job?.startDate ?? ""} className="input" />
          </label>
          <label className="block">
            <span className="label">Target completion</span>
            <input name="targetDate" type="date" defaultValue={job?.targetDate ?? ""} className="input" />
          </label>
        </div>
      )}
      <label className="block">
        <span className="label">{isNew ? "Enquiry notes" : "Description / scope summary"}</span>
        <textarea name="description" rows={3} defaultValue={job?.description ?? ""} className="input" placeholder="What does the client want?" />
      </label>
      {isNew ? (
        <fieldset>
          <span className="label">Includes a pool?</span>
          <div className="flex gap-2">
            {[
              ["yes", "Yes – pool job"],
              ["no", "No pool"],
            ].map(([v, l]) => (
              <label key={v} className="flex flex-1 items-center gap-2 rounded-lg border border-line-strong px-3 py-2.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                <input type="radio" name="hasPool" value={v} defaultChecked={v === "yes"} className="accent-[var(--color-accent)]" />
                {l}
              </label>
            ))}
          </div>
          <p className="hint">Sets up the standard SDL stages – you can change them later.</p>
        </fieldset>
      ) : (
        <label className="block">
          <span className="label">Site info for supervisors & inductions</span>
          <textarea name="siteInfo" rows={3} defaultValue={job?.siteInfo ?? ""} className="input" placeholder="Access, hazards, assembly point, first aid, parking…" />
        </label>
      )}
    </div>
  );
}
