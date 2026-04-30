"use client";

import { ArrowUp, MoveRight, Timer, Activity, type LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  ArrowUp,
  MoveRight,
  Timer,
  Activity,
};

export interface TestIconProps {
  iconKey: string;
  size?: number;
  className?: string;
}

/**
 * Map a `PerformanceTestType.iconKey` string to a Lucide icon. Falls back to
 * `Activity` if the key is unknown so the UI never renders a broken slot.
 */
export function TestIcon({ iconKey, size = 20, className }: TestIconProps) {
  const Icon = ICON_MAP[iconKey] ?? Activity;
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" className={className} />;
}
