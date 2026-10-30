import { NoteForm } from "@/components/note-form";
import { SiteHeader } from "@/components/site/site-ui";
import { requireUser } from "@/lib/auth";
import { ENTRY_TYPES, type EntryType } from "@/lib/constants";
import { activeUsers, getJob } from "@/lib/queries";

export const metadata = { title: "Add note" };

const TITLES: Record<string, string> = {
  photo: "Photos / note",
  note: "Note",
  client: "Client conversation",
  issue: "Problem or unforeseen item",
  unforeseen: "Problem or unforeseen item",
};

export default async function NotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const { type: t } = await searchParams;
  const type = (t && t in ENTRY_TYPES ? t : "note") as EntryType;
  const [job, people] = await Promise.all([getJob(Number(id)), activeUsers()]);
  const types: EntryType[] = type === "issue" || type === "unforeseen" ? ["issue", "unforeseen"] : type === "client" ? ["client"] : ["photo", "note"];
  return (
    <>
      <SiteHeader back={`/site/jobs/${job.id}`} title={TITLES[type] ?? "Note"} sub={job.name} />
      {type === "client" && <p className="mb-4 text-sm text-muted">Record what the client asked for or agreed. Tick “Potential variation” if it changes the scope or price.</p>}
      <div className="card p-4">
        <NoteFormWithRedirect jobId={job.id} users={people} currentUserId={me.id} type={type} types={types} />
      </div>
    </>
  );
}

function NoteFormWithRedirect(props: { jobId: number; users: { id: number; name: string }[]; currentUserId: number; type: EntryType; types: EntryType[] }) {
  return <NoteForm jobId={props.jobId} users={props.users} currentUserId={props.currentUserId} defaultType={props.type} types={props.types} then={`/site/jobs/${props.jobId}`} />;
}
