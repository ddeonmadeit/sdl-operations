import Link from "next/link";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { Briefcase, MapPin, Plus } from "lucide-react";
import { ActionForm, Modal, SubmitButton } from "@/components/client";
import { JobFields } from "@/components/office/job-fields";
import { Avatar, cx, EmptyState, PageHeader, ProgressBar, StatusBadge, Tabs } from "@/components/ui";
import { db } from "@/db";
import { contacts, jobs, stages, users } from "@/db/schema";
import { createJob } from "@/lib/actions/jobs";
import { requireOffice } from "@/lib/auth";
import { ACTIVE_STATUSES, JOB_STATUSES, LEAD_STATUSES, STAGE_STATUSES, type JobStatus } from "@/lib/constants";
import { moneyShort, relDay } from "@/lib/format";
import { activeUsers, contactOptions } from "@/lib/queries";

export const metadata = { title: "Jobs" };

const VIEWS = {
  leads: { label: "Leads", statuses: LEAD_STATUSES },
  active: { label: "Active", statuses: ACTIVE_STATUSES },
  completed: { label: "Completed", statuses: ["completed"] as JobStatus[] },
  lost: { label: "Lost", statuses: ["lost"] as JobStatus[] },
};
type View = keyof typeof VIEWS;

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string }> }) {
  await requireOffice();
  const sp = await searchParams;
  const view: View = sp.view && sp.view in VIEWS ? (sp.view as View) : "active";
  const q = (sp.q ?? "").trim().toLowerCase();

  const [rows, allStages, clients, people, counts] = await Promise.all([
    db
      .select({ job: jobs, client: contacts.name, supervisor: users.name })
      .from(jobs)
      .leftJoin(contacts, eq(contacts.id, jobs.clientId))
      .leftJoin(users, eq(users.id, jobs.supervisorId))
      .where(inArray(jobs.status, VIEWS[view].statuses))
      .orderBy(desc(jobs.updatedAt)),
    db.select().from(stages).orderBy(asc(stages.sortOrder), asc(stages.id)),
    contactOptions(["client"]),
    activeUsers(),
    db.select({ status: jobs.status }).from(jobs),
  ]);

  const filtered = q
    ? rows.filter((r) => [r.job.name, r.client, r.job.siteAddress].some((v) => v?.toLowerCase().includes(q)))
    : rows;
  const countFor = (v: View) => counts.filter((c) => VIEWS[v].statuses.includes(c.status as JobStatus)).length;
  const groups = VIEWS[view].statuses.map((status) => ({ status, items: filtered.filter((r) => r.job.status === status) }));
  const groupTotal = (items: typeof filtered) =>
    items.reduce((s, r) => s + (r.job.contractValueCents || r.job.estimatedValueCents), 0);

  return (
    <>
      <PageHeader
        title="Jobs"
        subtitle="Every enquiry and project, from first call to completion"
        actions={
          <Modal title="New enquiry" trigger={<><Plus className="size-4" /> New enquiry</>} triggerClassName="btn btn-primary">
            <ActionForm action={createJob} success="Enquiry created">
              <JobFields clients={clients} supervisors={people} isNew />
              <SubmitButton className="btn-primary mt-4 w-full">Create enquiry</SubmitButton>
            </ActionForm>
          </Modal>
        }
      />
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          current={`/office/jobs?view=${view}`}
          tabs={(Object.keys(VIEWS) as View[]).map((v) => ({ href: `/office/jobs?view=${v}`, label: VIEWS[v].label, count: countFor(v) }))}
        />
      </div>
      <form className="mb-5">
        <input type="hidden" name="view" value={view} />
        <input name="q" defaultValue={sp.q} placeholder="Search name, client or address…" className="input max-w-md" type="search" />
      </form>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Briefcase className="size-5" />} title={q ? "No matches" : `No ${VIEWS[view].label.toLowerCase()} jobs`}>
            {view === "leads" ? "New enquiries you add will show here." : null}
          </EmptyState>
        </div>
      ) : (
        <div className={cx("grid gap-5", groups.length >= 4 ? "xl:grid-cols-4 lg:grid-cols-2" : groups.length === 2 ? "lg:grid-cols-2" : "")}>
          {groups.map((g) => (
            <section key={g.status} className="min-w-0">
              {groups.length > 1 && (
                <div className="mb-2 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <StatusBadge map={JOB_STATUSES} value={g.status} />
                    <span className="text-muted">{g.items.length}</span>
                  </div>
                  <span className="text-xs font-medium text-muted tabular-nums">{moneyShort(groupTotal(g.items))}</span>
                </div>
              )}
              <div className={cx("grid gap-2.5", groups.length === 1 && "sm:grid-cols-2 xl:grid-cols-3")}>
                {g.items.map(({ job, client, supervisor }) => {
                  const st = allStages.filter((s) => s.jobId === job.id);
                  const done = st.filter((s) => s.status === "signed_off" || s.status === "complete").length;
                  const current = st.find((s) => s.status !== "signed_off" && s.status !== "complete");
                  const active = ACTIVE_STATUSES.includes(job.status as JobStatus) || job.status === "completed";
                  return (
                    <Link key={job.id} href={`/office/jobs/${job.id}`} className="card block p-3.5 transition hover:border-line-strong hover:shadow-[var(--shadow-pop)]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{job.name}</div>
                          <div className="truncate text-sm text-muted">{client ?? "No client"}</div>
                        </div>
                        <div className="shrink-0 text-right text-sm font-semibold tabular-nums">
                          {moneyShort(job.contractValueCents || job.estimatedValueCents)}
                        </div>
                      </div>
                      {job.siteAddress && (
                        <div className="mt-1.5 flex items-center gap-1 truncate text-xs text-muted">
                          <MapPin className="size-3.5 shrink-0" /> {job.siteAddress}
                        </div>
                      )}
                      {active && st.length > 0 && (
                        <div className="mt-3">
                          <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                            <span className="truncate font-medium text-ink-2">
                              {job.status === "completed" ? "Complete" : current ? current.name : "All stages done"}
                            </span>
                            {current && current.status !== "not_started" && <StatusBadge map={STAGE_STATUSES} value={current.status} />}
                          </div>
                          <ProgressBar value={(done / st.length) * 100} />
                        </div>
                      )}
                      <div className="mt-3 flex items-center justify-between text-xs text-muted">
                        <span className="flex items-center gap-1.5">
                          {supervisor ? (
                            <>
                              <Avatar name={supervisor} size="sm" /> {supervisor}
                            </>
                          ) : (
                            job.source ?? ""
                          )}
                        </span>
                        <span>{job.startDate && active ? `Start ${relDay(job.startDate)}` : `Updated ${relDay(job.updatedAt.toISOString().slice(0, 10))}`}</span>
                      </div>
                    </Link>
                  );
                })}
                {g.items.length === 0 && <div className="rounded-xl border border-dashed border-line-strong px-3 py-6 text-center text-xs text-muted">None</div>}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
