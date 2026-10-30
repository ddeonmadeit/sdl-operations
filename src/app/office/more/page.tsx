import Link from "next/link";
import { CalendarDays, ChevronRight, FilePen, LogOut, Settings, Smartphone, Users } from "lucide-react";
import { Avatar } from "@/components/ui";
import { requireOffice } from "@/lib/auth";

export const metadata = { title: "More" };

export default async function MorePage() {
  const me = await requireOffice();
  const links = [
    { href: "/office/schedule", label: "Schedule", icon: CalendarDays },
    { href: "/office/variations", label: "Variations", icon: FilePen },
    { href: "/office/contacts", label: "Contacts", icon: Users },
    { href: "/office/settings", label: "Settings", icon: Settings },
    { href: "/site", label: "Open site app", icon: Smartphone },
  ];
  return (
    <div className="mx-auto max-w-lg">
      <div className="card mb-4 flex items-center gap-3 p-4">
        <Avatar name={me.name} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{me.name}</div>
          <div className="truncate text-sm text-muted">{me.email}</div>
        </div>
      </div>
      <div className="card divide-y divide-line">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-subtle">
            <Icon className="size-5 text-muted" />
            <span className="flex-1 font-medium">{label}</span>
            <ChevronRight className="size-4 text-muted" />
          </Link>
        ))}
      </div>
      <form action="/logout" method="post" className="mt-4">
        <button className="btn w-full">
          <LogOut className="size-4" /> Sign out
        </button>
      </form>
    </div>
  );
}
