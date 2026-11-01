import { and, asc, eq, ne } from "drizzle-orm";
import { HardHat } from "lucide-react";
import { Section, SiteHeader } from "@/components/site/site-ui";
import { cx, StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { labourBookings } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { BOOKING_STATUSES, STAGE_STATUSES } from "@/lib/constants";
import { addDays, fmtDate, relDay, today } from "@/lib/format";
import { getJob, jobStages } from "@/lib/queries";

export const metadata = { title: "Schedule" };

export default async function SiteSchedule({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const job = await getJob(Number(id));
  const [stageRows, bookings] = await Promise.all([
    jobStages(job.id),
    db.select().from(labourBookings).where(and(eq(labourBookings.jobId, job.id), ne(labourBookings.status, "cancelled"))).orderBy(asc(labourBookings.date)),
  ]);
  const t0 = today();
  return (
    <>
      <SiteHeader back={`/site/jobs/${job.id}`} title="Schedule" sub={job.name} />
      <Section title="Stages">
        <ol className="card divide-y divide-line">
          {stageRows.map((s) => {
            const now = s.startDate && s.startDate <= t0 && (s.endDate ?? s.startDate) >= t0;
            return (
              <li key={s.id} className={cx("flex items-center gap-3 px-4 py-3", now && "bg-accent-soft/60")}>
                <span
                  className={cx(
                    "size-2.5 shrink-0 rounded-full",
                    s.status === "signed_off" ? "bg-leaf" : s.status === "complete" ? "bg-clay" : s.status === "in_progress" ? "bg-olive" : "bg-line-strong",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{s.name}</div>
                  <div className="truncate text-xs text-muted">
                    {s.contact?.name ?? (s.kind === "sdl" ? "SDL + KPR" : "TBC")}
                    {s.startDate ? ` · ${fmtDate(s.startDate, { weekday: true })} – ${fmtDate(s.endDate ?? s.startDate, { weekday: true })}` : " · not scheduled"}
                  </div>
                </div>
                {s.status !== "not_started" && <StatusBadge map={STAGE_STATUSES} value={s.status} />}
              </li>
            );
          })}
        </ol>
      </Section>
      <Section title="KPR labour">
        <div className="card divide-y divide-line">
          {bookings.length === 0 && <p className="px-4 py-4 text-sm text-muted">No labour booked.</p>}
          {bookings.map((b) => {
            const past = addDays(b.date, b.days - 1) < t0;
            return (
              <div key={b.id} className={cx("flex items-center gap-3 px-4 py-3", past && "opacity-50")}>
                <HardHat className="size-5 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {b.workers} worker{b.workers > 1 ? "s" : ""} · {relDay(b.date)}
                    {b.days > 1 ? ` – ${fmtDate(addDays(b.date, b.days - 1), { weekday: true })}` : ""}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {b.startTime} · {b.hours}h/day · {b.task}
                  </div>
                </div>
                <StatusBadge map={BOOKING_STATUSES} value={b.status} />
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}
