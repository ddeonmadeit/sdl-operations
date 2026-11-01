import { and, desc, eq, gte, ilike, lte } from "drizzle-orm";
import { ActionForm, DateNav, DraftKeeper, SubmitButton, Uploader } from "@/components/client";
import { PhotoGrid } from "@/components/shared";
import { LabourRows } from "@/components/site/labour-rows";
import { SiteHeader } from "@/components/site/site-ui";
import { db } from "@/db";
import { dailyLogs, entries, files, inductions, labourBookings, labourEntries } from "@/db/schema";
import { saveDailyLog } from "@/lib/actions/site";
import { requireUser } from "@/lib/auth";
import { addDays, relDay, today } from "@/lib/format";
import { getJob, jobStages } from "@/lib/queries";

export const metadata = { title: "Daily log" };

const WEATHER = ["Fine", "Hot", "Overcast", "Windy", "Showers", "Rain – work stopped"];

export default async function DailyLogPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const job = await getJob(Number(id));
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today();

  const [[log], stageRows, booking, kprInducted] = await Promise.all([
    db.select().from(dailyLogs).where(and(eq(dailyLogs.jobId, job.id), eq(dailyLogs.date, date), eq(dailyLogs.authorId, me.id))),
    jobStages(job.id),
    db
      .select()
      .from(labourBookings)
      .where(and(eq(labourBookings.jobId, job.id), eq(labourBookings.status, "booked"), lte(labourBookings.date, date), gte(labourBookings.date, addDays(date, -30))))
      .then((rows) => rows.find((b) => addDays(b.date, b.days - 1) >= date)),
    db
      .select({ name: inductions.name })
      .from(inductions)
      .where(and(eq(inductions.jobId, job.id), ilike(inductions.company, "%kpr%")))
      .orderBy(desc(inductions.createdAt))
      .limit(20),
  ]);

  const [labour, notes, photos] = log
    ? await Promise.all([
        db.select().from(labourEntries).where(eq(labourEntries.dailyLogId, log.id)),
        db.select().from(entries).where(eq(entries.dailyLogId, log.id)),
        db.select({ id: files.id, name: files.name, mimeType: files.mimeType }).from(files).where(and(eq(files.ownerType, "log"), eq(files.ownerId, log.id))),
      ])
    : [[], [], []];

  // Prefill KPR workers: saved rows → today's booking (named from KPR inductions) → none
  const names = [...new Set(kprInducted.map((k) => k.name))];
  const kprRows = log
    ? labour.filter((l) => l.kind === "kpr").map((l) => ({ name: l.name, hours: l.hours }))
    : booking
      ? Array.from({ length: booking.workers }, (_, i) => ({ name: names[i] ?? `KPR worker ${i + 1}`, hours: booking.hours }))
      : [];
  const myHours = log ? (labour.find((l) => l.kind === "sdl")?.hours ?? 0) : null;
  const currentStage = stageRows.find((s) => s.status === "in_progress") ?? stageRows.find((s) => s.status === "not_started");
  const subbies = [...new Set(stageRows.map((s) => s.contact?.name).filter(Boolean))] as string[];

  return (
    <>
      <SiteHeader back={`/site/jobs/${job.id}`} title="Daily log" sub={`${job.name} · ${relDay(date)}${log ? " · editing" : ""}`} />
      <ActionForm action={saveDailyLog.bind(null, job.id)} reset={false} success="Daily log saved" then={`/site/jobs/${job.id}`}>
        {!log && <DraftKeeper storageKey={`log-${job.id}-${date}`} />}
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Date</span>
              <DateNav name="date" value={date} max={today()} />
            </label>
            <label className="block">
              <span className="label">Stage</span>
              <select name="stageId" defaultValue={log?.stageId ?? currentStage?.id ?? ""} className="input">
                <option value="">–</option>
                {stageRows.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="label">Work completed today</span>
            <textarea name="workCompleted" rows={4} defaultValue={log?.workCompleted ?? ""} className="input" placeholder="What got done?" />
          </label>

          <div>
            <span className="label">Labour hours</span>
            <LabourRows myName={me.name} myHours={myHours} kpr={kprRows} defaultHours={booking?.hours ?? 8} />
            {booking && !log && <p className="hint">Prefilled from KPR booking PO-{booking.id}. Adjust to what actually happened.</p>}
          </div>

          <label className="block">
            <span className="label">Subcontractors on site</span>
            <input name="subbiesOnSite" defaultValue={log?.subbiesOnSite ?? ""} className="input" list="subbies" placeholder="Who was here?" />
            <datalist id="subbies">
              {subbies.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>

          <fieldset>
            <span className="label">Weather</span>
            <div className="flex flex-wrap gap-1.5">
              {WEATHER.map((w) => (
                <label key={w} className="cursor-pointer rounded-full border border-line-strong px-3 py-1.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-cream">
                  <input type="radio" name="weather" value={w} defaultChecked={(log?.weather ?? "") === w} className="sr-only" />
                  {w}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="label">Problems / issues</span>
            <textarea name="issue" rows={2} defaultValue={notes.find((n) => n.type === "issue")?.body ?? ""} className="input" placeholder="Anything that went wrong or is holding things up" />
          </label>
          <label className="block">
            <span className="label">Unforeseen items</span>
            <textarea name="unforeseen" rows={2} defaultValue={notes.find((n) => n.type === "unforeseen")?.body ?? ""} className="input" placeholder="Rock, services, old footings, access…" />
            <span className="hint block">Issues and unforeseen items go straight to the office. Use “Potential variation” if it may cost the client.</span>
          </label>

          <div>
            <span className="label">Photos</span>
            {photos.length > 0 && <PhotoGrid files={photos} className="mb-2" />}
            <Uploader jobId={job.id} />
          </div>
        </div>
        <div className="safe-bottom sticky bottom-16 z-10 -mx-4 mt-6 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur">
          <SubmitButton className="btn-primary btn-lg w-full">{log ? "Update daily log" : "Save daily log"}</SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}
