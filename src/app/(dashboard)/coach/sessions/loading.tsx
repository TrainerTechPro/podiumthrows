import { SkeletonLine, SkeletonCard } from "@/components/ui/Skeleton";

export default function SessionsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <SkeletonLine className="w-40 h-7" />
        <SkeletonLine className="w-56 h-4" />
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-6 border-b border-[var(--card-border)] pb-0">
        {["Upcoming", "Recent", "Workout Plans"].map((label) => (
          <SkeletonLine key={label} className="w-20 h-4 mb-3" />
        ))}
      </div>

      {/* Table rows */}
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} className="p-3" />
        ))}
      </div>
    </div>
  );
}
