import Link from "next/link";
import { requireCoachSession, getWorkoutPlans } from "@/lib/data/coach";
import { Button } from "@/components/ui/Button";
import { PlansList } from "./_plans-list";

export const metadata = { title: "Workout Plans — Podium Throws" };

export default async function CoachPlansPage() {
  const { coach } = await requireCoachSession();
  const plans = await getWorkoutPlans(coach.id);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            Workout Plans
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Reusable training templates. Assign to athletes to schedule sessions.
          </p>
        </div>
        <Link href="/coach/plans/new">
          <Button variant="primary">New Plan</Button>
        </Link>
      </div>

      <PlansList plans={plans} />
    </div>
  );
}
