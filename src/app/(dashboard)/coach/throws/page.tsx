import { requireCoachSession } from "@/lib/data/coach";
import { getThrowsSessions, getThrowsRosterPulse } from "@/lib/data/throws";
import { ThrowsView } from "./_throws-view";

export default async function ThrowsDashboardPage() {
  const { coach } = await requireCoachSession();

  const [sessionsResult, pulseResult] = await Promise.allSettled([
    getThrowsSessions(coach.id),
    getThrowsRosterPulse(coach.id),
  ]);

  const sessions = sessionsResult.status === "fulfilled" ? sessionsResult.value : [];
  const pulse = pulseResult.status === "fulfilled" ? pulseResult.value : [];

  return <ThrowsView sessions={sessions} pulse={pulse} />;
}
