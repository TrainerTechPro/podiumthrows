import { requireCoachSession } from "@/lib/data/coach";
import { getThrowsSessions, getThrowsRosterPulse } from "@/lib/data/throws";
import { ThrowsView } from "./_throws-view";
import type { ThrowsSessionSummary, PulseRow } from "./_throws-view";

export default async function ThrowsDashboardPage() {
  const { coach } = await requireCoachSession();

  const [sessions, pulse] = await Promise.all([
    getThrowsSessions(coach.id),
    getThrowsRosterPulse(coach.id),
  ]);

  return (
    <ThrowsView
      sessions={sessions as unknown as ThrowsSessionSummary[]}
      pulse={pulse as unknown as PulseRow[]}
    />
  );
}
