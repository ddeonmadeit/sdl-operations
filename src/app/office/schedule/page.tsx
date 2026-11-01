import Link from "next/link";
import { and, asc, eq, gte, inArray, isNotNull, lte, ne } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cx, EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { contacts, jobs, labourBookings, stages } from "@/db/schema";
import { requireOffice } from "@/lib/auth";
import { stageBarClass } from "@/lib/constants";
import { addDays, daysBetween, fmtDate, today, weekStart } from "@/lib/format";

export const metadata = { title: "Schedule" };

const DAYS = 14;

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  await requireOffice();
  const { w } = await searchParams;
  const t0 = today();
  const start = w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? weekStart(w) : weekStart(t0);
  const end = addDays(start, DAYS - 1);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(start, i));

  const [stageRows, bookingRows] = await Promise.all([
    db
      .select({ s: stages, job: { id: jobs.id, name: jobs.name }, contact: contacts.name })
      .from(stages)
      .innerJoin(jobs, eq(jobs.id, stages.jobId))
      .leftJoin(contacts, eq(contacts.id, stages.contactId))
      .where(and(inArray(jobs.status, ["won", "in_progress", "completed"]), isNotNull(stages.startDate), lte(stages.startDate, end), gte(stages.endDate, start)))
      .orderBy(asc(stages.startDate)),
    db
      .select({ b: labourBookings, job: { id: jobs.id, name: jobs.name } })
      .from(labourBookings)
      .innerJoin(jobs, eq(jobs.id, labourBookings.jobId))
      .where(and(ne(labourBookings.status, "cancelled"), lte(labourBookings.date, end), gte(labourBookings.date, addDays(start, -30))))
      .orderBy(asc(labourBookings.date)),
  ]);
  const bookings = bookingRows.filter((r) => addDays(r.b.date, r.b.days - 1) >= start);

  const jobIds = [...new Set([...stageRows.map((r) => r.job.id), ...bookings.map((r) => r.job.id)])];
  const jobNames = new Map([...stageRows, ...bookings].map((r) => [r.job.id, r.job.name]));
  const col = (d: string) => Math.max(0, Math.min(DAYS - 1, daysBetween(start, d)));

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={`${fmtDate(start, { weekday: true })} – ${fmtDate(end, { weekday: true, year: true })}`}
        actions={
          <div className="flex items-center gap-1">
            <Link href={`/office/schedule?w=${addDays(start, -7)}`} className="btn btn-sm btn-icon" aria-label="Previous week">
              <ChevronLeft className="size-4" />
            </Link>
            <Link href="/office/schedule" className="btn btn-sm">
              Today
            </Link>
            <Link href={`/office/schedule?w=${addDays(start, 7)}`} className="btn btn-sm btn-icon" aria-label="Next week">
              <ChevronRight className="size-4" />
            </Link>
          </div>
        }
      />

      {jobIds.length === 0 ? (
        <div className="card">
          <EmptyState title="Nothing scheduled in these two weeks">Set stage dates on each job&apos;s Schedule tab.</EmptyState>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid border-b border-line" style={{ gridTemplateColumns: `200px repeat(${DAYS}, 1fr)` }}>
              <div />
              {days.map((d) => {
                const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
                return (
                  <div key={d} className={cx("border-l border-line px-1 py-2 text-center text-[0.68rem]", d === t0 && "bg-accent-soft font-bold text-accent", (dow === 0 || dow === 6) && d !== t0 && "bg-subtle text-muted")}>
                    {fmtDate(d, { weekday: true }).replace(/ \w+$/, "")}
                  </div>
                );
              })}
            </div>
            {jobIds.map((jid) => {
              const st = stageRows.filter((r) => r.job.id === jid);
              const bk = bookings.filter((r) => r.job.id === jid);
              return (
                <div key={jid} className="border-b border-line last:border-0">
                  <div className="grid items-center" style={{ gridTemplateColumns: `200px repeat(${DAYS}, 1fr)` }}>
                    <Link href={`/office/jobs/${jid}/schedule`} className="self-start truncate px-4 py-2 text-sm font-semibold hover:underline" style={{ gridRow: `1 / span ${st.length + bk.length || 1}`, gridColumn: 1 }}>
                      {jobNames.get(jid)}
                    </Link>
                    {st.map(({ s, contact }, i) => (
                      <div
                        key={`s${s.id}`}
                        className={cx(
                          "mx-0.5 my-1 truncate rounded px-2 py-1 text-[0.7rem] font-semibold",
                          stageBarClass(s.status, s.kind),
                        )}
                        style={{ gridRow: i + 1, gridColumn: `${col(s.startDate!) + 2} / ${col(s.endDate ?? s.startDate!) + 3}` }}
                        title={`${s.name}${contact ? ` – ${contact}` : ""}`}
                      >
                        {s.name}
                        {contact ? ` · ${contact}` : ""}
                      </div>
                    ))}
                    {bk.map(({ b }, i) => (
                      <div
                        key={`b${b.id}`}
                        className={cx(
                          "mx-0.5 my-1 truncate rounded border px-2 py-1 text-[0.7rem] font-semibold",
                          b.status === "booked" ? "border-clay bg-clay-soft text-clay-ink" : "border-dashed border-clay bg-surface text-clay-ink",
                        )}
                        style={{ gridRow: st.length + i + 1, gridColumn: `${col(b.date) + 2} / ${col(addDays(b.date, b.days - 1)) + 3}` }}
                        title={b.task ?? ""}
                      >
                        KPR ×{b.workers}
                        {b.status === "requested" ? " (requested)" : ""}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
        {[
          ["bg-line-strong", "Subcontractor – not started"],
          ["bg-leaf-mid", "SDL + KPR"],
          ["bg-olive", "In progress"],
          ["bg-clay", "Complete – to check"],
          ["bg-leaf", "Signed off"],
        ].map(([c, l]) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <span className={cx("size-2.5 rounded-sm", c)} /> {l}
          </span>
        ))}
      </div>
    </>
  );
}
