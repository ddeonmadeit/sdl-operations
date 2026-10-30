import { DiaryFeed } from "@/components/diary-feed";
import { SiteHeader } from "@/components/site/site-ui";
import { isOffice, requireUser } from "@/lib/auth";
import { loadDiary } from "@/lib/diary";
import { getJob } from "@/lib/queries";

export const metadata = { title: "Site diary" };

export default async function SiteDiary({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const job = await getJob(Number(id));
  const items = await loadDiary(job.id, undefined, 30);
  return (
    <>
      <SiteHeader back={`/site/jobs/${job.id}`} title="Site diary" sub={job.name} />
      <DiaryFeed items={items} canModerate={isOffice(me)} currentUserId={me.id} />
    </>
  );
}
