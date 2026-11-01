"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  Ellipsis,
  FilePen,
  House,
  LayoutDashboard,
  ListChecks,
  Receipt,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cx } from "./ui";

export type NavItem = { href: string; label: string; icon: LucideIcon; count?: number; exact?: boolean; active?: boolean };

function isActive(path: string, item: NavItem) {
  if (item.active !== undefined) return item.active;
  return item.exact ? path === item.href : path === item.href || path.startsWith(item.href + "/");
}

function SideNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="space-y-0.5">
      {items.map((item) => {
        const active = isActive(path, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
              active ? "bg-cream/15 text-cream" : "text-cream/75 hover:bg-cream/10 hover:text-cream",
            )}
          >
            <Icon className="size-[18px]" strokeWidth={active ? 2.3 : 2} />
            <span className="flex-1">{item.label}</span>
            {item.count ? (
              <span className="rounded-full bg-cream px-1.5 py-px text-[0.7rem] font-semibold text-olive">{item.count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function TabBar({ items, className }: { items: NavItem[]; className?: string }) {
  const path = usePathname();
  return (
    <nav
      className={cx(
        "tabbar safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85",
        className,
      )}
    >
      <div className="mx-auto flex max-w-lg">
        {items.map((item) => {
          const active = isActive(path, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-active={active}
              className="relative flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[0.68rem] font-medium text-muted"
            >
              <span className="relative">
                <Icon className="size-[22px]" strokeWidth={active ? 2.3 : 1.9} />
                {item.count ? (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[1.1rem] rounded-full bg-olive px-1 text-center text-[0.62rem] leading-[1.1rem] font-bold text-cream ring-2 ring-surface">
                    {item.count > 99 ? "99+" : item.count}
                  </span>
                ) : null}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export type Counts = { approvals?: number; tasks?: number; variations?: number };

const officeItems = (c: Counts): NavItem[] => [
  { href: "/office", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/office/jobs", label: "Jobs", icon: Briefcase },
  { href: "/office/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/office/approvals", label: "Approvals", icon: Receipt, count: c.approvals },
  { href: "/office/variations", label: "Variations", icon: FilePen, count: c.variations },
  { href: "/office/tasks", label: "Tasks", icon: ListChecks, count: c.tasks },
  { href: "/office/contacts", label: "Contacts", icon: Users },
  { href: "/office/settings", label: "Settings", icon: Settings },
];

export function OfficeSideNav({ counts }: { counts: Counts }) {
  return <SideNav items={officeItems(counts)} />;
}

export function OfficeTabBar({ counts }: { counts: Counts }) {
  const path = usePathname();
  const all = officeItems(counts);
  const main = [all[0]!, all[1]!, all[3]!, all[5]!];
  const moreActive = !main.some((i) => isActive(path, i));
  return (
    <TabBar
      className="lg:hidden"
      items={[
        ...main,
        { href: "/office/more", label: "More", icon: Ellipsis, count: counts.variations, active: moreActive },
      ]}
    />
  );
}

export function SiteTabBar({ counts }: { counts: Counts }) {
  return (
    <TabBar
      items={[
        { href: "/site", label: "Today", icon: House, exact: true },
        { href: "/site/jobs", label: "Jobs", icon: Briefcase },
        { href: "/site/tasks", label: "Tasks", icon: ListChecks, count: counts.tasks },
        { href: "/site/more", label: "More", icon: Ellipsis },
      ]}
    />
  );
}
