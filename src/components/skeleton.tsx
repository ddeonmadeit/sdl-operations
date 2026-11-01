import { cx } from "./ui";

export function Bone({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-subtle", className)} />;
}

/** Placeholder shown the instant a page is tapped, while its data loads. */
export function PageSkeleton({ variant = "office" }: { variant?: "office" | "site" }) {
  if (variant === "site")
    return (
      <div className="space-y-4 pt-2" aria-busy="true" aria-label="Loading">
        <Bone className="h-4 w-24" />
        <Bone className="h-8 w-2/3" />
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Bone key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Bone className="h-32 rounded-2xl" />
        <Bone className="h-20 rounded-2xl" />
      </div>
    );
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Bone className="h-8 w-56" />
        <Bone className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Bone key={i} className="h-24 rounded-[14px]" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Bone className="h-64 rounded-[14px]" />
        <Bone className="h-64 rounded-[14px]" />
      </div>
    </div>
  );
}
