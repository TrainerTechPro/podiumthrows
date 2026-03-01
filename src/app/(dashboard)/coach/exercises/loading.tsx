import { SkeletonLine, SkeletonTableRow } from "@/components/ui/Skeleton";

export default function CoachExercisesLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <SkeletonLine className="w-40 h-7" />
        <SkeletonLine className="w-48 h-4" />
      </div>

      {/* Category tabs + search + button */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2">
          {["All", "CE", "SDE", "SPE", "GPE"].map((label) => (
            <SkeletonLine key={label} className="w-14 h-8 rounded-lg" />
          ))}
        </div>
        <div className="flex gap-2">
          <SkeletonLine className="w-48 h-9 rounded-lg" />
          <SkeletonLine className="w-28 h-9 rounded-xl" />
        </div>
      </div>

      {/* Table */}
      <div className="card !p-0">
        <div className="flex gap-4 px-4 py-3 border-b border-[var(--card-border)]">
          {["Name", "Category", "Event", "Equipment", "Weight"].map((col) => (
            <SkeletonLine key={col} className="flex-1 h-3" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonTableRow key={i} cols={5} />
        ))}
      </div>
    </div>
  );
}
