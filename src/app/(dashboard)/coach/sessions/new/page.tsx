import Link from "next/link";
import {
  requireCoachSession,
  getExerciseLibrary,
  getAthletePickerList,
} from "@/lib/data/coach";
import { SessionWizard } from "./_session-wizard";

export default async function NewSessionPage() {
  const { coach } = await requireCoachSession();
  const [exercises, athletes] = await Promise.all([
    getExerciseLibrary(coach.id),
    getAthletePickerList(coach.id),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/coach/sessions"
          className="p-1.5 rounded-lg text-surface-400 hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          aria-label="Back to sessions"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            New Session
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Build a workout plan, configure exercises, and optionally assign to athletes.
          </p>
        </div>
      </div>

      {/* Client-side wizard */}
      <SessionWizard exercises={exercises} athletes={athletes} />
    </div>
  );
}
