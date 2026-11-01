import { and, desc, eq, inArray } from "drizzle-orm";
import { FileText, Trash2, Upload } from "lucide-react";
import { ActionButton, ActionForm, Modal, SubmitButton, Uploader } from "@/components/client";
import { PhotoGrid } from "@/components/shared";
import { Badge, Card, EmptyState } from "@/components/ui";
import { db } from "@/db";
import { files, users } from "@/db/schema";
import { attachJobFiles, deleteJobFile } from "@/lib/actions/jobs";
import { requireOffice } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { getJob } from "@/lib/queries";

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default async function FilesPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOffice();
  const { id } = await params;
  const job = await getJob(Number(id));
  const [docs, photos] = await Promise.all([
    db
      .select({ f: files, by: users.name })
      .from(files)
      .leftJoin(users, eq(users.id, files.uploadedById))
      .where(and(eq(files.jobId, job.id), eq(files.ownerType, "job")))
      .orderBy(desc(files.createdAt)),
    db
      .select({ id: files.id, name: files.name, mimeType: files.mimeType })
      .from(files)
      .where(and(eq(files.jobId, job.id), inArray(files.ownerType, ["log", "entry", "variation"]), eq(files.category, "photo")))
      .orderBy(desc(files.createdAt))
      .limit(120),
  ]);

  return (
    <div className="space-y-5">
      <Card
        title="Plans & documents"
        pad={false}
        action={
          <Modal title="Upload plans or documents" trigger={<><Upload className="size-4" /> Upload</>} triggerClassName="btn btn-sm btn-primary">
            <ActionForm action={attachJobFiles.bind(null, job.id)}>
              <div className="space-y-3">
                <select name="category" className="input" defaultValue="plan">
                  <option value="plan">Plans & drawings</option>
                  <option value="document">Other document</option>
                </select>
                <Uploader jobId={job.id} variant="files" category="plan" label="Choose files" />
              </div>
              <SubmitButton className="btn-primary mt-4 w-full">Save</SubmitButton>
            </ActionForm>
          </Modal>
        }
      >
        {docs.length === 0 ? (
          <EmptyState icon={<FileText className="size-5" />} title="No plans uploaded">Uploaded plans and documents are available to supervisors in the site app.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {docs.map(({ f, by }) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="size-5 shrink-0 text-muted" />
                <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium hover:underline">{f.name}</div>
                  <div className="text-xs text-muted">
                    {kb(f.size)} · {by} · {fmtDate(f.createdAt.toISOString())}
                  </div>
                </a>
                <Badge tone={f.category === "plan" ? "info" : "neutral"}>{f.category === "plan" ? "Plan" : "Document"}</Badge>
                <ActionButton action={deleteJobFile.bind(null, f.id)} confirm={`Delete ${f.name}?`} className="btn-ghost btn-icon btn-sm" title="Delete">
                  <Trash2 className="size-4 text-muted" />
                </ActionButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={`Site photos (${photos.length})`}>
        {photos.length ? <PhotoGrid files={photos} /> : <p className="text-sm text-muted">Photos from daily logs, notes and variations collect here.</p>}
      </Card>
    </div>
  );
}
