import { SkeletonLine, SkeletonTableRow } from "@/components/ui/Skeleton";

export default function AthleteCodexLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="space-y-2">
        <SkeletonLine className="w-36 h-7" />
        <SkeletonLine className="w-48 h-4" />
      </div>
      <SkeletonLine className="w-full h-10 rounded-xl" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonLine key={i} className="w-20 h-8 rounded-full" />
        ))}
      </div>
      <div className="card divide-y divide-[var(--card-border)]">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonTableRow key={i} cols={5} />
        ))}
      </div>
    </div>
  );
}
