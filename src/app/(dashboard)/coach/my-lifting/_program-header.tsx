import type {
  LiftingProgram,
  LiftingProgramPhase,
  LiftingWorkoutLog,
} from "@prisma/client";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type ProgramWithRelations = LiftingProgram & {
  phases: LiftingProgramPhase[];
  workoutLogs: LiftingWorkoutLog[];
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function safeJsonParse<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function getCurrentPhase(program: ProgramWithRelations): LiftingProgramPhase | null {
  const completedWeeks = new Set<number>();
  for (const log of program.workoutLogs) {
    if (log.status === "COMPLETED") {
      completedWeeks.add(log.weekNumber);
    }
  }

  // Find the earliest week that doesn't have all workouts completed
  for (let week = 1; week <= program.totalWeeks; week++) {
    const logsForWeek = program.workoutLogs.filter(
      (l) => l.weekNumber === week && l.status === "COMPLETED"
    );
    if (logsForWeek.length < program.workoutsPerWeek) {
      // This week is current — find the phase it belongs to
      return (
        program.phases.find(
          (p) => p.startWeek <= week && week <= p.endWeek
        ) ?? null
      );
    }
  }

  // All weeks done — return last phase
  return program.phases[program.phases.length - 1] ?? null;
}

/* ─── RPE Color Config ───────────────────────────────────────────────────── */

const RPE_SLOT_COLORS = [
  { bg: "bg-green-500", label: "Easy" },
  { bg: "bg-yellow-500", label: "Moderate" },
  { bg: "bg-orange-500", label: "Hard" },
  { bg: "bg-red-500", label: "Max Effort" },
];

/* ─── Component ──────────────────────────────────────────────────────────── */

export function ProgramHeader({ program }: { program: ProgramWithRelations }) {
  const goals = safeJsonParse<string[]>(program.goals) ?? [];
  const rpeTargets = safeJsonParse<string[]>(program.rpeTargets) ?? [];
  const currentPhase = getCurrentPhase(program);

  // Progress: completed workout logs / total possible workouts
  const totalWorkouts = program.totalWeeks * program.workoutsPerWeek;
  const completedWorkouts = program.workoutLogs.filter(
    (l) => l.status === "COMPLETED"
  ).length;
  const progressPct =
    totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0;

  return (
    <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 p-6">
      {/* Title + Phase Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-2xl font-heading font-bold text-surface-900 dark:text-surface-100">
          {program.name}
        </h1>
        {currentPhase && (
          <span className="inline-flex items-center bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap">
            {currentPhase.name}
          </span>
        )}
      </div>

      {/* Goal Badges */}
      {goals.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {goals.map((goal) => (
            <span
              key={goal}
              className="bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 px-2.5 py-0.5 rounded-full text-xs font-medium"
            >
              {goal}
            </span>
          ))}
        </div>
      )}

      {/* Progress Bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400 mb-1.5">
          <span>
            {completedWorkouts} / {totalWorkouts} workouts
          </span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-2.5 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* RPE Scale */}
      <div>
        <p className="text-xs text-surface-500 dark:text-surface-400 mb-2 font-medium uppercase tracking-wide">
          RPE by Workout
        </p>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: program.workoutsPerWeek }).map((_, i) => {
            const color = RPE_SLOT_COLORS[i] ?? RPE_SLOT_COLORS[RPE_SLOT_COLORS.length - 1];
            const rpeLabel = rpeTargets[i] ?? rpeTargets[rpeTargets.length - 1] ?? "—";
            return (
              <div
                key={i}
                className="flex items-center gap-2 bg-surface-50 dark:bg-surface-800/60 rounded-lg px-3 py-2"
              >
                <div
                  className={`w-3 h-3 rounded-sm shrink-0 ${color.bg}`}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-surface-900 dark:text-surface-100">
                    W{i + 1}
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    RPE {rpeLabel}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
