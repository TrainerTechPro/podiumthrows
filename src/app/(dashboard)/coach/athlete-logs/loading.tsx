import { SkeletonLine, SkeletonTableRow } from "@/components/ui/Skeleton";

export default function CoachAthleteLogsLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <SkeletonLine className="w-48 h-7" />
        <SkeletonLine className="w-64 h-4" />
      </div>
      {/* Filter pills */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonLine key={i} className="w-20 h-8 rounded-full" />
        ))}
      </div>
      <div className="card divide-y divide-[var(--card-border)]">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonTableRow key={i} cols={4} />
        ))}
      </div>
    </div>
  );
}
