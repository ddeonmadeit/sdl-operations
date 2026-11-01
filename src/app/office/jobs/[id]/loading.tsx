import { Bone } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]" aria-busy="true" aria-label="Loading">
      <div className="space-y-5">
        <Bone className="h-56 rounded-[14px]" />
        <Bone className="h-40 rounded-[14px]" />
      </div>
      <div className="space-y-5">
        <Bone className="h-32 rounded-[14px]" />
        <Bone className="h-44 rounded-[14px]" />
      </div>
    </div>
  );
}
