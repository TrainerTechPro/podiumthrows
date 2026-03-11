import { SkeletonLine, SkeletonTableRow } from "@/components/ui/Skeleton";

export default function AthleteAssessmentsLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-2">
        <SkeletonLine className="w-40 h-7" />
        <SkeletonLine className="w-56 h-4" />
      </div>
      <div className="card divide-y divide-[var(--card-border)]">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonTableRow key={i} cols={3} />
        ))}
      </div>
    </div>
  );
}
