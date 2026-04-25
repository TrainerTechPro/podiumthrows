import { Skeleton } from "@/components/ui/Skeleton";

export default function BuilderLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="border-b border-[var(--card-border)] flex gap-2 pb-1">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-lg" />
        ))}
      </div>

      <div className="pt-3 space-y-4">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    </div>
  );
}
