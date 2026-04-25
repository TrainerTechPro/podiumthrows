import { redirect } from "next/navigation";
import { requireCoachSession } from "@/lib/data/coach";
import { ThrowsView } from "../_views/throws-view";

export const metadata = { title: "Throws Program — Podium Throws" };

/**
 * Roster-wide Podium Profile / deficit-finder view as a Tier-2 sibling under
 * /coach/athletes. Same ThrowsView the existing /coach/athletes?tab=throws
 * branch renders — coaches who land here get the comparative grid, not the
 * single-athlete drilldown (that lives at /coach/athletes/[id]?tab=throws).
 *
 * Saved-team-preference resolution from the legacy ?tab=throws route is
 * intentionally NOT replicated here — the ?teamId= URL param is honored,
 * but coaches starting fresh see the unfiltered view. The legacy route
 * still serves with full saved-pref behavior until commit 5 redirects.
 *
 * Earns its existence by covering an action no other surface handles:
 * roster-wide Podium Profile state — enrollment, comp-PB editing, deficit
 * comparison across the team. When a second comparative lens (Strength,
 * Wellness) joins, fold this back into Roster as a lens picker.
 */
export default async function CoachAthletesThrowsPage({
  searchParams,
}: {
  searchParams: { teamId?: string };
}) {
  try {
    await requireCoachSession();
  } catch {
    redirect("/login");
  }

  const teamId =
    searchParams.teamId && searchParams.teamId !== "unassigned" ? searchParams.teamId : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-heading font-bold text-[var(--foreground)]">
          Throws Program
        </h1>
        <p className="text-sm text-muted mt-0.5">
          Podium Profile state across your roster. Enrollment, competition PBs, and deficit
          comparison.
        </p>
      </div>

      <ThrowsView teamId={teamId} />
    </div>
  );
}
