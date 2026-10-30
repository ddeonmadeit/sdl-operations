import { Uploader } from "@/components/client";
import { BILL_KINDS } from "@/lib/constants";
import { today } from "@/lib/format";

type Opt = { id: number; name: string };

/** Fields for entering a supplier / subcontractor / KPR invoice for checking. */
export function BillFields({
  jobs,
  jobId,
  stages,
  contacts,
}: {
  jobs?: Opt[];
  jobId?: number;
  stages: { id: number; name: string; jobId?: number; jobName?: string }[];
  contacts: (Opt & { type: string })[];
}) {
  const grouped = jobs && !jobId;
  return (
    <div className="space-y-3">
      {jobId ? (
        <input type="hidden" name="jobId" value={jobId} />
      ) : (
        <label className="block">
          <span className="label">Job</span>
          <select name="jobId" required className="input" defaultValue="">
            <option value="" disabled>
              Choose job…
            </option>
            {jobs?.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 block sm:col-span-1">
          <span className="label">From</span>
          <select name="contactId" required className="input" defaultValue="">
            <option value="" disabled>
              Who sent it?
            </option>
            {(["labour_hire", "subcontractor", "supplier"] as const).map((t) => (
              <optgroup key={t} label={t === "labour_hire" ? "Labour hire" : t === "subcontractor" ? "Subcontractors" : "Suppliers"}>
                {contacts
                  .filter((c) => c.type === t)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="col-span-2 block sm:col-span-1">
          <span className="label">Type</span>
          <select name="kind" className="input" defaultValue="">
            <option value="">Work it out from the contact</option>
            {Object.entries(BILL_KINDS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Their invoice #</span>
          <input name="reference" className="input" />
        </label>
        <label className="block">
          <span className="label">Stage</span>
          <select name="stageId" className="input" defaultValue="">
            <option value="">–</option>
            {grouped
              ? jobs!.map((j) => {
                  const list = stages.filter((s) => s.jobId === j.id);
                  return list.length ? (
                    <optgroup key={j.id} label={j.name}>
                      {list.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null;
                })
              : stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Amount ($ ex GST)</span>
          <input name="amount" inputMode="decimal" required className="input" placeholder="0.00" />
        </label>
        <label className="block">
          <span className="label">GST ($)</span>
          <input name="gst" inputMode="decimal" className="input" placeholder="Auto 10%" />
        </label>
        <label className="block">
          <span className="label">Invoice date</span>
          <input name="invoiceDate" type="date" defaultValue={today()} className="input" />
        </label>
        <label className="block">
          <span className="label">Due date</span>
          <input name="dueDate" type="date" className="input" />
        </label>
      </div>
      <details className="rounded-lg border border-line px-3 py-2">
        <summary className="text-sm font-medium">Labour hire details (KPR)</summary>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <label className="block">
            <span className="label">Hours billed</span>
            <input name="hours" type="number" step="0.25" className="input" />
          </label>
          <label className="block">
            <span className="label">From</span>
            <input name="periodFrom" type="date" className="input" />
          </label>
          <label className="block">
            <span className="label">To</span>
            <input name="periodTo" type="date" className="input" />
          </label>
        </div>
        <p className="hint">Used to compare against the hours supervisors logged on site.</p>
      </details>
      <label className="block">
        <span className="label">Description</span>
        <input name="description" className="input" placeholder="What is it for?" />
      </label>
      <div>
        <span className="label">Invoice copy</span>
        <Uploader jobId={jobId} category="invoice" variant="files" label="Attach PDF or photo" />
      </div>
    </div>
  );
}
