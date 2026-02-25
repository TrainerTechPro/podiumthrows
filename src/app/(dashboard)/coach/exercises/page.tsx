import { requireCoachSession, getExerciseLibrary } from "@/lib/data/coach";
import { ExercisesTable } from "./_exercises-table";

export default async function ExercisesPage() {
  const { coach } = await requireCoachSession();
  const exercises = await getExerciseLibrary(coach.id);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
          Exercise Library
        </h1>
        <p className="text-sm text-muted mt-0.5">
          {exercises.length} exercises available.
          System exercises are shared across all coaches.
          Add your own custom exercises for your program.
        </p>
      </div>

      {/* Client-side interactive table with category tabs, search, add/edit/delete */}
      <ExercisesTable exercises={exercises} />
    </div>
  );
}
