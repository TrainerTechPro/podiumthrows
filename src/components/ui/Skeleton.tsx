import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Base shimmer block — set width/height via className or style */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-shimmer bg-gradient-to-r",
        "from-surface-200 via-surface-100 to-surface-200",
        "dark:from-surface-800 dark:via-surface-700 dark:to-surface-800",
        "bg-[length:200%_100%] rounded-xl",
        className
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

/** A single text line skeleton */
export function SkeletonLine({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn("h-4 rounded-md", className)} {...props} />;
}

/** Circular skeleton (for avatars) */
export function SkeletonCircle({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const s = { sm: "w-8 h-8", md: "w-10 h-10", lg: "w-14 h-14" }[size];
  return <Skeleton className={cn("rounded-full shrink-0", s, className)} />;
}

/** Full card skeleton with avatar, title, and lines */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("card p-5 space-y-4", className)}>
      <div className="flex items-center gap-3">
        <SkeletonCircle />
        <div className="flex-1 space-y-2">
          <SkeletonLine className="w-2/5" />
          <SkeletonLine className="w-1/4 h-3" />
        </div>
      </div>
      <div className="space-y-2">
        <SkeletonLine />
        <SkeletonLine className="w-5/6" />
        <SkeletonLine className="w-3/4" />
      </div>
    </div>
  );
}

/** Table row skeleton */
export function SkeletonTableRow({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex gap-4 px-4 py-3.5 border-b border-[var(--card-border)] last:border-0">
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonLine
          key={i}
          className={cn("flex-1", i === 0 ? "max-w-[120px]" : undefined)}
        />
      ))}
    </div>
  );
}

/** Stat card skeleton */
export function SkeletonStat({ className }: { className?: string }) {
  return (
    <div className={cn("card p-5 space-y-2", className)}>
      <SkeletonLine className="w-1/2 h-3" />
      <SkeletonLine className="w-1/3 h-7" />
      <SkeletonLine className="w-2/5 h-3" />
    </div>
  );
}
