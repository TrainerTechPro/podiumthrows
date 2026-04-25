import { Skeleton } from "@/components/ui/Skeleton";

export default function LibraryLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="border-b border-[var(--card-border)] flex gap-2 pb-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-lg" />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
