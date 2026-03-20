import { HTMLAttributes } from "react";
import Image from "next/image";
import { cn, getInitials } from "@/lib/utils";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type AvatarStatus = "online" | "offline" | "away" | "none";

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  status?: AvatarStatus;
}

const sizes: Record<AvatarSize, { container: string; text: string; status: string }> = {
  xs: { container: "w-6 h-6",   text: "text-[9px]",  status: "w-1.5 h-1.5 ring-1" },
  sm: { container: "w-8 h-8",   text: "text-xs",     status: "w-2 h-2 ring-1" },
  md: { container: "w-10 h-10", text: "text-sm",     status: "w-2.5 h-2.5 ring-[1.5px]" },
  lg: { container: "w-14 h-14", text: "text-base",   status: "w-3 h-3 ring-2" },
  xl: { container: "w-20 h-20", text: "text-xl",     status: "w-3.5 h-3.5 ring-2" },
};

const statusColors: Record<AvatarStatus, string> = {
  online:  "bg-success-500",
  offline: "bg-surface-400",
  away:    "bg-warning-500",
  none:    "hidden",
};

/** Deterministic color based on name — amber/gold family stays primary */
function getAvatarColor(name: string): string {
  const colors = [
    "bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300",
    "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
    "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
    "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ name, src, size = "md", status = "none", className, ...props }: AvatarProps) {
  const { container, text, status: statusSize } = sizes[size];
  const initials = getInitials(name);
  const colorClasses = getAvatarColor(name);

  return (
    <div className={cn("relative inline-flex shrink-0", className)} {...props}>
      <div
        className={cn(
          "rounded-full overflow-hidden select-none",
          container,
          src ? "relative" : cn("flex items-center justify-center font-semibold", colorClasses)
        )}
        aria-label={name}
      >
        {src ? (
          <Image src={src} alt={name} fill className="object-cover" sizes="80px" />
        ) : (
          <span className={text}>{initials}</span>
        )}
      </div>
      {status !== "none" && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-[var(--background)]",
            statusSize,
            statusColors[status]
          )}
          aria-label={status}
        />
      )}
    </div>
  );
}
