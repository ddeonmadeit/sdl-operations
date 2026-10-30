import Link from "next/link";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { ChevronLeft, MapPin, Pencil, Phone } from "lucide-react";
import { ActionForm, AutoSelect, Modal, SubmitButton } from "@/components/client";
import { JobFields } from "@/components/office/job-fields";
import { JobTabs } from "@/components/office/job-tabs";
import { db } from "@/db";
import { bills, entries, labourBookings, stages, variations } from "@/db/schema";
import { setJobStatus, updateJob } from "@/lib/actions/jobs";
import { requireOffice } from "@/lib/auth";
import { JOB_STATUSES } from "@/lib/constants";
import { jobRef, telHref } from "@/lib/format";
import { activeUsers, contactOptions, getJob } from "@/lib/queries";

export default async function JobLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  await requireOffice();
  const { id } = await params;
  const job = await getJob(Number(id));
  const [clients, people, [stageCheck], [kprReq], [varNew], [billsPending], [openIssues]] = await Promise.all([
    contactOptions(["client"]),
    activeUsers(),
    db.select({ n: count() }).from(stages).where(and(eq(stages.jobId, job.id), eq(stages.status, "complete"))),
    db.select({ n: count() }).from(labourBookings).where(and(eq(labourBookings.jobId, job.id), eq(labourBookings.status, "requested"))),
    db.select({ n: count() }).from(variations).where(and(eq(variations.jobId, job.id), eq(variations.status, "identified"))),
    db.select({ n: count() }).from(bills).where(and(eq(bills.jobId, job.id), eq(bills.status, "pending"))),
    db
      .select({ n: count() })
      .from(entries)
      .where(and(eq(entries.jobId, job.id), inArray(entries.type, ["issue", "unforeseen"]), isNull(entries.resolvedAt))),
  ]);

  return (
    <>
      <div className="mb-4">
        <Link href="/office/jobs" className="-ml-1 mb-2 inline-flex items-center gap-0.5 text-sm font-medium text-muted hover:text-ink">
          <ChevronLeft className="size-4" /> Jobs
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-bold tracking-tight">{job.name}</h1>
              <span className="shrink-0 text-sm font-medium text-muted">{jobRef(job.id)}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              {job.client && (
                <Link href={`/office/contacts/${job.client.id}`} className="font-medium text-ink-2 hover:underline">
                  {job.client.name}
                </Link>
              )}
              {job.client?.phone && (
                <a href={telHref(job.client.phone)} className="inline-flex items-center gap-1 hover:text-ink">
                  <Phone className="size-3.5" /> {job.client.phone}
                </a>
              )}
              {job.siteAddress && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(job.siteAddress)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-ink"
                >
                  <MapPin className="size-3.5" /> {job.siteAddress}
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AutoSelect
              ariaLabel="Job status"
              action={setJobStatus.bind(null, job.id)}
              name="status"
              defaultValue={job.status}
              options={Object.entries(JOB_STATUSES).map(([value, d]) => ({ value, label: d.label }))}
              className="w-40"
              success="Status updated"
            />
            <Modal title="Edit job" trigger={<><Pencil className="size-4" /> Edit</>} triggerClassName="btn btn-sm h-9">
              <ActionForm action={updateJob.bind(null, job.id)} success="Job saved" reset={false}>
                <JobFields clients={clients} supervisors={people} job={job} />
                <SubmitButton className="btn-primary mt-4 w-full">Save changes</SubmitButton>
              </ActionForm>
            </Modal>
          </div>
        </div>
      </div>
      <JobTabs
        jobId={job.id}
        counts={{ schedule: (stageCheck?.n ?? 0) + (kprReq?.n ?? 0), variations: varNew?.n ?? 0, costs: billsPending?.n ?? 0, diary: openIssues?.n ?? 0 }}
      />
      {children}
    </>
  );
}
