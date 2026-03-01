import Link from "next/link";
import {
  requireCoachSession,
  getCoachSessions,
  getWorkoutPlans,
} from "@/lib/data/coach";
import { Button } from "@/components/ui/Button";
import { SessionsTabs } from "./_sessions-tabs";

export default async function SessionsPage() {
  const { coach } = await requireCoachSession();
  const [sessionsResult, plansResult] = await Promise.allSettled([
    getCoachSessions(coach.id),
    getWorkoutPlans(coach.id),
  ]);

  const sessions = sessionsResult.status === "fulfilled" ? sessionsResult.value : [];
  const plans = plansResult.status === "fulfilled" ? plansResult.value : [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            Sessions
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Manage workout plans and track athlete sessions.
          </p>
        </div>
        <Link href="/coach/sessions/new">
          <Button variant="primary">New Session</Button>
        </Link>
      </div>

      {/* Client tabs */}
      <SessionsTabs sessions={sessions} plans={plans} />
    </div>
  );
}
