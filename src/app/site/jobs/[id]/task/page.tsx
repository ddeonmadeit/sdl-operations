import { ActionForm, SubmitButton } from "@/components/client";
import { TaskFields } from "@/components/shared";
import { SiteHeader } from "@/components/site/site-ui";
import { createTask } from "@/lib/actions/tasks";
import { requireUser } from "@/lib/auth";
import { activeUsers, getJob } from "@/lib/queries";

export const metadata = { title: "Follow-up task" };

export default async function SiteTask({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const [job, people] = await Promise.all([getJob(Number(id)), activeUsers()]);
  return (
    <>
      <SiteHeader back={`/site/jobs/${job.id}`} title="Follow-up task" sub={job.name} />
      <div className="card p-4">
        <ActionForm action={createTask} success="Task added – visible to the office" then={`/site/jobs/${job.id}`}>
          <TaskFields users={people} jobId={job.id} currentUserId={me.id} />
          <SubmitButton className="btn-primary btn-lg mt-5 w-full">Add task</SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}
