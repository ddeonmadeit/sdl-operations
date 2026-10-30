import { and, desc, eq } from "drizzle-orm";
import { FileText } from "lucide-react";
import { SiteHeader } from "@/components/site/site-ui";
import { EmptyState } from "@/components/ui";
import { db } from "@/db";
import { files } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { getJob } from "@/lib/queries";

export const metadata = { title: "Plans" };

export default async function SitePlans({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const job = await getJob(Number(id));
  const docs = await db.select().from(files).where(and(eq(files.jobId, job.id), eq(files.ownerType, "job"))).orderBy(desc(files.category), desc(files.createdAt));
  return (
    <>
      <SiteHeader back={`/site/jobs/${job.id}`} title="Plans & documents" sub={job.name} />
      {docs.length === 0 ? (
        <div className="card">
          <EmptyState icon={<FileText className="size-5" />} title="No plans uploaded yet">The office uploads plans and drawings to the job.</EmptyState>
        </div>
      ) : (
        <div className="card divide-y divide-line">
          {docs.map((f) => (
            <a key={f.id} href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3.5 active:bg-subtle">
              {f.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/files/${f.id}`} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-subtle text-muted">
                  <FileText className="size-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{f.name}</div>
                <div className="text-xs text-muted">
                  {f.category === "plan" ? "Plan" : "Document"} · {fmtDate(f.createdAt.toISOString())}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
