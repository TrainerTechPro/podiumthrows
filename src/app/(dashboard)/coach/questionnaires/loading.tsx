import { SkeletonLine } from "@/components/ui/Skeleton";

export default function CoachQuestionnairesLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <SkeletonLine className="w-40 h-7" />
          <SkeletonLine className="w-56 h-4" />
        </div>
        <SkeletonLine className="w-28 h-9 rounded-xl" />
      </div>

      {/* List of questionnaire cards */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card p-4 flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <SkeletonLine className="w-2/5 h-5" />
              <div className="flex gap-2">
                <SkeletonLine className="w-16 h-5 rounded-full" />
                <SkeletonLine className="w-14 h-5 rounded-full" />
              </div>
              <SkeletonLine className="w-1/3 h-3" />
            </div>
            <SkeletonLine className="w-4 h-4 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
