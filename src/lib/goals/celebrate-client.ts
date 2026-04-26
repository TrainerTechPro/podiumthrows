"use client";

import type { useToast } from "@/components/ui/Toast";
import { celebrationCopy, type MilestoneCelebration } from "@/lib/goals/milestones";

type ToastApi = ReturnType<typeof useToast>;

/**
 * Fires UI feedback for one or more goal milestone celebrations:
 *   - 25/50/75 → toast.celebration with goal-specific copy.
 *   - 100      → onCompletion callback (triggers full-screen overlay).
 *
 * The completion overlay is owned by the page that renders it (because it
 * needs to manage `show` state and dismiss timing). Pass `onCompletion`
 * with the celebration record so the page can hand it to PRCelebration.
 */
export function fireGoalCelebrations(
  celebrations: MilestoneCelebration[],
  toast: ToastApi,
  onCompletion?: (c: MilestoneCelebration) => void
): void {
  for (const c of celebrations) {
    if (c.completed && onCompletion) {
      onCompletion(c);
      // Skip the celebration toast for completion — the overlay is the
      // moment. A toast underneath would be redundant.
      continue;
    }
    const copy = celebrationCopy(c);
    toast.celebration(copy.title, {
      description: copy.body,
      duration: 4500,
    });
  }
}
