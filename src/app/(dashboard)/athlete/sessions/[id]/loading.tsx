import { Skeleton, SkeletonLine } from "@/components/ui/Skeleton";

export default function SessionDetailLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back link + header */}
      <div className="space-y-3">
        <SkeletonLine className="w-24 h-4" />
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <SkeletonLine className="w-52 h-7" />
            <SkeletonLine className="w-36 h-4" />
          </div>
          <SkeletonLine className="w-20 h-6 rounded-full shrink-0" />
        </div>
      </div>

      {/* Throwing blocks */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <SkeletonLine className="w-32 h-5" />
            <SkeletonLine className="w-16 h-5 rounded-full" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex gap-4 py-2 border-b border-[var(--card-border)] last:border-0">
                <SkeletonLine className="w-8 h-4 shrink-0" />
                <SkeletonLine className="flex-1 h-4" />
                <SkeletonLine className="w-16 h-4 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Complete button area */}
      <Skeleton className="w-full h-12 rounded-xl" />
    </div>
  );
}
