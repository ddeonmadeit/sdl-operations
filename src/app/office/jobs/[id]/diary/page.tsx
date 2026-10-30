import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Plus, QrCode } from "lucide-react";
import { CopyButton, Modal } from "@/components/client";
import { DiaryFeed } from "@/components/diary-feed";
import { NoteForm } from "@/components/note-form";
import { Card, cx, EmptyState } from "@/components/ui";
import { db } from "@/db";
import { inductions, users } from "@/db/schema";
import { requireOffice } from "@/lib/auth";
import { loadDiary } from "@/lib/diary";
import { appUrl } from "@/lib/email";
import { fmtDateTime } from "@/lib/format";
import { activeUsers, getJob } from "@/lib/queries";

const FILTERS = [
  ["", "All"],
  ["log", "Daily logs"],
  ["client", "Client conversations"],
  ["issue", "Issues"],
  ["unforeseen", "Unforeseen"],
  ["photo", "Photos"],
  ["induction", "Inductions"],
] as const;

export default async function DiaryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ f?: string }> }) {
  const me = await requireOffice();
  const { id } = await params;
  const { f = "" } = await searchParams;
  const job = await getJob(Number(id));
  const people = await activeUsers();
  const base = `/office/jobs/${job.id}/diary`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {FILTERS.map(([k, label]) => (
            <Link
              key={k}
              href={k ? `${base}?f=${k}` : base}
              scroll={false}
              className={cx("shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium", f === k ? "border-ink bg-ink text-white" : "border-line-strong bg-surface hover:bg-subtle")}
            >
              {label}
            </Link>
          ))}
        </div>
        <Modal title="Add to diary" trigger={<><Plus className="size-4" /> Note</>} triggerClassName="btn btn-sm">
          <NoteForm jobId={job.id} users={people} currentUserId={me.id} />
        </Modal>
      </div>
      {f === "induction" ? <InductionRegister jobId={job.id} token={job.inductionToken} /> : <DiaryFeed items={await loadDiary(job.id, f || undefined)} canModerate currentUserId={me.id} />}
    </div>
  );
}

async function InductionRegister({ jobId, token }: { jobId: number; token: string | null }) {
  const rows = await db
    .select({ i: inductions, by: users.name })
    .from(inductions)
    .leftJoin(users, eq(users.id, inductions.inductedById))
    .where(eq(inductions.jobId, jobId))
    .orderBy(desc(inductions.createdAt));
  const link = token ? `${appUrl()}/induct/${token}` : null;
  return (
    <Card
      title={`Induction register (${rows.length})`}
      pad={false}
      action={
        link ? (
          <div className="flex gap-2">
            <CopyButton text={link} className="btn-sm" label="Copy worker link" />
            <Link href={`/site/jobs/${jobId}/induction/qr`} className="btn btn-sm">
              <QrCode className="size-4" /> QR
            </Link>
          </div>
        ) : null
      }
    >
      {rows.length === 0 ? (
        <EmptyState title="No one inducted yet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">White card</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2 font-medium">Signed</th>
                <th className="px-4 py-2 font-medium">Signature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ i, by }) => (
                <tr key={i.id}>
                  <td className="px-4 py-2 font-medium">{i.name}</td>
                  <td className="px-3 py-2">{i.company}</td>
                  <td className="px-3 py-2">{i.whiteCard}</td>
                  <td className="px-3 py-2">{i.phone}</td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {fmtDateTime(i.createdAt)}
                    <br />
                    {i.selfSigned ? "Own phone" : `With ${by ?? "supervisor"}`}
                  </td>
                  <td className="px-4 py-2">
                    {i.signatureData.length > 100 && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.signatureData} alt={`Signature of ${i.name}`} className="h-10 max-w-[140px] object-contain" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
