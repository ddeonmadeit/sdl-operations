import Link from "next/link";
import { ChevronRight, LogOut, Monitor } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/client";
import { Section, SiteHeader } from "@/components/site/site-ui";
import { Avatar } from "@/components/ui";
import { changeMyPassword } from "@/lib/actions/admin";
import { isOffice, requireUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

export const metadata = { title: "More" };

export default async function SiteMore() {
  const me = await requireUser();
  return (
    <>
      <SiteHeader title="More" />
      <div className="card mb-5 flex items-center gap-3 p-4">
        <Avatar name={me.name} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{me.name}</div>
          <div className="truncate text-sm text-muted">
            {ROLES[me.role]} · {me.email}
          </div>
        </div>
      </div>
      {isOffice(me) && (
        <div className="card mb-5">
          <Link href="/office" className="flex items-center gap-3 px-4 py-3.5">
            <Monitor className="size-5 text-muted" />
            <span className="flex-1 font-medium">Open office app</span>
            <ChevronRight className="size-4 text-muted" />
          </Link>
        </div>
      )}
      <Section title="Add to home screen">
        <div className="card p-4 text-sm text-muted">
          <p>
            <b className="text-ink">iPhone:</b> tap Share <span aria-hidden>⎋</span> then “Add to Home Screen”.
          </p>
          <p className="mt-1.5">
            <b className="text-ink">Android:</b> tap ⋮ then “Install app” or “Add to Home screen”.
          </p>
        </div>
      </Section>
      <Section title="Change password">
        <div className="card p-4">
          <ActionForm action={changeMyPassword}>
            <div className="space-y-3">
              <input name="current" type="password" required placeholder="Current password" className="input" autoComplete="current-password" />
              <input name="next" type="password" required minLength={8} placeholder="New password (8+ characters)" className="input" autoComplete="new-password" />
            </div>
            <SubmitButton className="btn-primary mt-3 w-full">Change password</SubmitButton>
          </ActionForm>
        </div>
      </Section>
      <form action="/logout" method="post">
        <button className="btn w-full">
          <LogOut className="size-4" /> Sign out
        </button>
      </form>
    </>
  );
}
