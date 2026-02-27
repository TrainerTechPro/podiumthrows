"use client";

/**
 * Live preview of what the athlete sees for a coach-built session.
 * Renders the "Session Overview" view inside the iPhone frame.
 */

interface PreviewExercise {
  exerciseName: string;
  isGhost?: boolean;
  prescribedSets?: number;
  prescribedReps?: number;
  prescribedLoad?: number;
  prescribedRPE?: number;
  prescribedDuration?: number;
  prescribedDistance?: number;
  prescribedPace?: string;
  prescribedHRZone?: number;
  recoveryTime?: number;
  notes?: string;
  explanationLevel?: string;
  explanation?: string;
}

interface SessionPreviewProps {
  sessionName: string;
  scheduledDate: string;
  description: string;
  exercises: PreviewExercise[];
  workoutType?: string;
}

export function SessionPreview({
  sessionName,
  scheduledDate,
  description,
  exercises,
  workoutType,
}: SessionPreviewProps) {
  const totalSets = exercises.reduce((s, ex) => s + (ex.prescribedSets || 0), 0);
  const maxLoad = exercises.reduce((m, ex) => Math.max(m, ex.prescribedLoad || 0), 0);

  const formattedDate = scheduledDate
    ? new Date(scheduledDate + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const isEmpty = !sessionName && exercises.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <p className="text-sm text-gray-400 font-medium mb-1">
          Start building your session
        </p>
        <p className="text-xs text-gray-500 max-w-[220px]">
          Add a name and exercises to see what your athlete will see
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Back button (decorative) */}
      <div className="flex items-center gap-1 text-[11px] text-gray-400 mb-3">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Sessions
      </div>

      {/* Session header */}
      <div className="mb-4">
        <h1 className="text-lg font-bold text-white leading-tight">
          {sessionName || "Untitled Session"}
        </h1>
        {formattedDate && (
          <p className="text-[11px] text-gray-400 mt-0.5">{formattedDate}</p>
        )}
        {workoutType && (
          <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-600/30 text-amber-400">
            {workoutType.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {description && (
        <div className="bg-gray-800/50 rounded-xl p-3 mb-4">
          <p className="text-[11px] text-gray-300 leading-relaxed">{description}</p>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-gray-800/50 rounded-xl text-center py-2.5">
          <p className="text-base font-bold text-white">{exercises.length}</p>
          <p className="text-[9px] text-gray-400">Exercises</p>
        </div>
        <div className="bg-gray-800/50 rounded-xl text-center py-2.5">
          <p className="text-base font-bold text-white">{totalSets || "–"}</p>
          <p className="text-[9px] text-gray-400">Total Sets</p>
        </div>
        <div className="bg-gray-800/50 rounded-xl text-center py-2.5">
          <p className="text-base font-bold text-white">
            {maxLoad > 0 ? `${maxLoad}kg` : "–"}
          </p>
          <p className="text-[9px] text-gray-400">Max Load</p>
        </div>
      </div>

      {/* Exercise list */}
      {exercises.length > 0 && (
        <div className="bg-gray-800/50 rounded-xl p-3 mb-4">
          <h2 className="text-xs font-semibold text-white mb-3">Exercise Plan</h2>
          <div className="space-y-2">
            {exercises.map((ex, i) => (
              <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg bg-gray-800/60">
                {/* Number badge */}
                <div className="w-6 h-6 rounded-md bg-amber-600/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-amber-400">{i + 1}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-[11px] font-semibold text-white truncate">
                      {ex.exerciseName}
                    </h3>
                    {ex.isGhost && (
                      <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-purple-900/40 text-purple-400 flex-shrink-0">
                        CUSTOM
                      </span>
                    )}
                    {ex.explanationLevel === "EXPLAIN_WHY" && (
                      <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-blue-900/40 text-blue-400 flex-shrink-0 flex items-center gap-0.5">
                        <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        WHY
                      </span>
                    )}
                    {ex.explanationLevel === "JUST_DO_IT" && (
                      <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-gray-700/60 text-gray-400 flex-shrink-0 flex items-center gap-0.5">
                        <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        DO IT
                      </span>
                    )}
                  </div>

                  {/* Prescription details */}
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                    {ex.prescribedSets && (
                      <span className="text-[10px] text-gray-300">
                        <span className="font-semibold">{ex.prescribedSets}</span> sets
                      </span>
                    )}
                    {ex.prescribedReps && (
                      <span className="text-[10px] text-gray-300">
                        <span className="font-semibold">{ex.prescribedReps}</span> reps
                      </span>
                    )}
                    {ex.prescribedLoad && (
                      <span className="text-[10px] text-gray-300">
                        @ <span className="font-semibold">{ex.prescribedLoad}</span>kg
                      </span>
                    )}
                    {ex.prescribedRPE && (
                      <span className="text-[10px] text-gray-300">
                        RPE <span className="font-semibold">{ex.prescribedRPE}</span>
                      </span>
                    )}
                    {ex.prescribedDuration && (
                      <span className="text-[10px] text-gray-300">
                        <span className="font-semibold">{ex.prescribedDuration}</span> min
                      </span>
                    )}
                    {ex.prescribedDistance && (
                      <span className="text-[10px] text-gray-300">
                        <span className="font-semibold">{ex.prescribedDistance}</span>m
                      </span>
                    )}
                    {ex.prescribedPace && (
                      <span className="text-[10px] text-gray-300">
                        @ <span className="font-semibold">{ex.prescribedPace}</span>/km
                      </span>
                    )}
                    {ex.prescribedHRZone && (
                      <span className="text-[10px] text-gray-300">
                        Z<span className="font-semibold">{ex.prescribedHRZone}</span>
                      </span>
                    )}
                    {ex.recoveryTime && (
                      <span className="text-[10px] text-gray-300">
                        <span className="font-semibold">{ex.recoveryTime}</span>s rec
                      </span>
                    )}
                  </div>

                  {ex.notes && (
                    <p className="text-[9px] text-amber-400/80 mt-0.5 italic truncate">
                      {ex.notes}
                    </p>
                  )}

                  {ex.explanationLevel === "EXPLAIN_WHY" && ex.explanation && (
                    <div className="mt-1 p-1.5 rounded bg-blue-900/20 border border-blue-800/30">
                      <p className="text-[8px] font-semibold text-blue-400 mb-0.5">Your coach explains:</p>
                      <p className="text-[9px] text-blue-300/80 leading-relaxed line-clamp-2">
                        {ex.explanation}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Start Workout button (decorative) */}
      <div className="bg-amber-600 rounded-xl py-3.5 text-center">
        <div className="flex items-center justify-center gap-2 text-white">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-bold">Start Workout</span>
        </div>
      </div>
    </div>
  );
}
