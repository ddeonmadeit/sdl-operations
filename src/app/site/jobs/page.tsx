import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { SiteHeader } from "@/components/site/site-ui";
import { Avatar, Badge, EmptyState, ProgressBar } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { siteJobs } from "@/lib/site";

export const metadata = { title: "Jobs" };

export default async function SiteJobs() {
  const me = await requireUser();
  const list = await siteJobs(me.id);
  return (
    <>
      <SiteHeader title="Jobs" sub={`${list.length} active`} />
      {list.length === 0 ? (
        <div className="card">
          <EmptyState title="No active jobs" />
        </div>
      ) : (
        <div className="card divide-y divide-line">
          {list.map((j) => (
            <Link key={j.id} href={`/site/jobs/${j.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-subtle">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{j.name}</span>
                  {j.mine && <Badge tone="green">Mine</Badge>}
                </div>
                {j.siteAddress && (
                  <div className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted">
                    <MapPin className="size-3.5 shrink-0" /> {j.siteAddress}
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <ProgressBar value={j.progress * 100} className="flex-1" />
                  <span className="shrink-0 text-xs text-muted">{j.currentStage?.name ?? (j.status === "won" ? "Not started" : "")}</span>
                </div>
              </div>
              {j.client && <Avatar name={j.client.name} size="sm" />}
              <ChevronRight className="size-5 shrink-0 text-muted" />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
