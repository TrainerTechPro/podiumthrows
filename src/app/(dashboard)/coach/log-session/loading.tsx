import { Skeleton, SkeletonLine } from "@/components/ui/Skeleton";

export default function CoachLogSessionLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-2">
        <SkeletonLine className="w-44 h-7" />
        <SkeletonLine className="w-64 h-4" />
      </div>

      {/* Form skeleton — single column, like the real shape */}
      <div className="card p-6 space-y-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <SkeletonLine className="w-24 h-3" />
            <Skeleton className="w-full h-10 rounded-lg" />
          </div>
        ))}
        <Skeleton className="w-full h-11 rounded-xl" />
      </div>
    </div>
  );
}
