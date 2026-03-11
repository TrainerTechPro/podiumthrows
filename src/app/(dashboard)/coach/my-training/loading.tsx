import { SkeletonLine, SkeletonTableRow } from "@/components/ui/Skeleton";

export default function CoachMyTrainingLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <SkeletonLine className="w-36 h-7" />
          <SkeletonLine className="w-28 h-4" />
        </div>
        <SkeletonLine className="w-28 h-9 rounded-xl" />
      </div>
      <div className="card divide-y divide-[var(--card-border)]">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonTableRow key={i} cols={3} />
        ))}
      </div>
    </div>
  );
}
