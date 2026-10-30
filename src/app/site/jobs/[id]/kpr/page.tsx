import { and, asc, eq, gte } from "drizzle-orm";
import { ActionButton, ActionForm, SubmitButton } from "@/components/client";
import { BookingFields } from "@/components/office/booking-fields";
import { Section, SiteHeader } from "@/components/site/site-ui";
import { StatusBadge } from "@/components/ui";
import { db } from "@/db";
import { labourBookings } from "@/db/schema";
import { cancelBooking, requestBooking } from "@/lib/actions/labour";
import { requireUser } from "@/lib/auth";
import { BOOKING_STATUSES } from "@/lib/constants";
import { addDays, fmtDate, relDay, today } from "@/lib/format";
import { getJob, jobStages } from "@/lib/queries";

export const metadata = { title: "Request KPR labour" };

export default async function KprRequest({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const job = await getJob(Number(id));
  const [stageRows, upcoming] = await Promise.all([
    jobStages(job.id),
    db
      .select()
      .from(labourBookings)
      .where(and(eq(labourBookings.jobId, job.id), gte(labourBookings.date, addDays(today(), -30))))
      .orderBy(asc(labourBookings.date)),
  ]);
  const current = upcoming.filter((b) => b.status !== "cancelled" && addDays(b.date, b.days - 1) >= today());
  return (
    <>
      <SiteHeader back={`/site/jobs/${job.id}`} title="Request KPR labour" sub={job.name} />
      <p className="mb-4 text-sm text-muted">All labour hire goes through the office. They&apos;ll book it with KPR and you&apos;ll see it confirmed here.</p>
      <div className="card mb-6 p-4">
        <ActionForm action={requestBooking.bind(null, job.id)} then={`/site/jobs/${job.id}`}>
          <BookingFields stages={stageRows} />
          <SubmitButton className="btn-primary btn-lg mt-5 w-full">Send request to office</SubmitButton>
        </ActionForm>
      </div>
      {current.length > 0 && (
        <Section title="Booked & requested">
          <div className="card divide-y divide-line">
            {current.map((b) => (
              <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {b.workers} × {relDay(b.date)}
                    {b.days > 1 ? ` – ${fmtDate(addDays(b.date, b.days - 1), { weekday: true })}` : ""} · {b.startTime}
                  </div>
                  <div className="truncate text-xs text-muted">{b.task}</div>
                </div>
                <StatusBadge map={BOOKING_STATUSES} value={b.status} />
                {b.status === "requested" && (
                  <ActionButton action={cancelBooking.bind(null, b.id)} confirm="Cancel this request?" className="btn-ghost btn-sm">
                    Cancel
                  </ActionButton>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
