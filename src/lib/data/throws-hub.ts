import { getUpcomingActivity } from "@/lib/data/athlete-activity";
import type { UpcomingSessionItem } from "@/lib/data/dashboard";

/**
 * Upcoming throws assignments for the Throws Hub widget.
 *
 * Phase 3a: delegates to the unified activity service. Filters to the throws
 * kind so the widget stays scoped to throws-only; if we later decide the
 * widget should show all upcoming work (strength + self-program too), drop
 * the kinds filter and the return shape stays compatible.
 */
export async function fetchUpcomingThrowsAssignments(
  athleteId: string
): Promise<UpcomingSessionItem[]> {
  const todayYMD = new Date().toISOString().slice(0, 10);

  const items = await getUpcomingActivity(athleteId, todayYMD, 3);

  return items
    .filter((it) => it.kind === "throws")
    .slice(0, 3)
    .map((it) => ({
      id: it.id,
      scheduledDate: it.scheduledAt?.toISOString() ?? todayYMD,
      status: statusToWidgetString(it.status),
      planName: it.title,
      coachNotes: null,
    }));
}

/**
 * The widget renders raw status strings with `toUpperCase()` comparisons.
 * Emit the status value from the source enum it corresponds to so existing
 * UI logic keeps working without a widget-side update.
 */
function statusToWidgetString(status: string): string {
  switch (status) {
    case "planned":
      return "ASSIGNED";
    case "active":
      return "IN_PROGRESS";
    case "completed":
      return "COMPLETED";
    case "partial":
      return "PARTIAL";
    case "skipped":
      return "SKIPPED";
    default:
      return "ASSIGNED";
  }
}
