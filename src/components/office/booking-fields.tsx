import type { LabourBooking } from "@/db/schema";
import { addDays, today } from "@/lib/format";

/** KPR booking fields – used by the office and the site app. */
export function BookingFields({ stages, booking }: { stages: { id: number; name: string }[]; booking?: LabourBooking }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Date</span>
          <input name="date" type="date" required defaultValue={booking?.date ?? addDays(today(), 1)} className="input" />
        </label>
        <label className="block">
          <span className="label">Start time</span>
          <input name="startTime" type="time" defaultValue={booking?.startTime ?? "07:00"} className="input" />
        </label>
        <label className="block">
          <span className="label">Workers</span>
          <input name="workers" type="number" min={1} max={30} defaultValue={booking?.workers ?? 2} className="input" inputMode="numeric" />
        </label>
        <label className="block">
          <span className="label">Days</span>
          <input name="days" type="number" min={1} max={30} defaultValue={booking?.days ?? 1} className="input" inputMode="numeric" />
        </label>
        <label className="block">
          <span className="label">Hours per day</span>
          <input name="hours" type="number" min={1} max={14} step="0.5" defaultValue={booking?.hours ?? 8} className="input" inputMode="decimal" />
        </label>
        <label className="block">
          <span className="label">Stage</span>
          <select name="stageId" defaultValue={booking?.stageId ?? ""} className="input">
            <option value="">–</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="label">What are they doing?</span>
        <input name="task" defaultValue={booking?.task ?? ""} className="input" placeholder="e.g. Demolition and site clean" />
      </label>
    </div>
  );
}
