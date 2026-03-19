"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components";
import { Select } from "@/components/ui/Select";
import { formatImplementWeight } from "@/lib/throws";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type AthleteOption = {
  id: string;
  firstName: string;
  lastName: string;
  events: string[];
};

type ExerciseRec = {
  id: string;
  name: string;
  category: string;
  event: string | null;
  implementWeight: number | null;
  equipment: string | null;
  correlation: number;
};

type AssessmentInfo = {
  athleteType: string;
  completedAt: string;
} | null;

type Props = {
  athletes: AthleteOption[];
  /** Pre-fetched recommendations keyed by event. Server passes the initial set. */
  initialRecommendations: ExerciseRec[];
  initialEvent: string | null;
  initialAthleteId: string | null;
  assessments: Record<string, AssessmentInfo>;
};

/* ─── Constants ──────────────────────────────────────────────────────────── */

const EVENT_OPTIONS = [
  { value: "SHOT_PUT", label: "Shot Put" },
  { value: "DISCUS", label: "Discus" },
  { value: "HAMMER", label: "Hammer" },
  { value: "JAVELIN", label: "Javelin" },
];

const CATEGORY_ORDER = ["CE", "SDE", "SPE", "GPE"];
const CATEGORY_LABELS: Record<string, string> = {
  CE: "Competitive Exercise",
  SDE: "Specialized Developmental",
  SPE: "Specific Preparatory",
  GPE: "General Preparatory",
};

const BONDARCHUK_COLORS: Record<string, "warning" | "primary" | "success" | "danger"> = {
  EXPLOSIVE: "warning",
  SPEED_STRENGTH: "primary",
  STRENGTH_SPEED: "success",
  STRENGTH: "danger",
};

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function ExerciseRecommender({
  athletes,
  initialRecommendations,
  initialEvent,
  initialAthleteId,
  assessments,
}: Props) {
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(initialAthleteId);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(initialEvent);
  const [recommendations, setRecommendations] = useState<ExerciseRec[]>(initialRecommendations);
  const [loading, setLoading] = useState(false);

  const athleteOptions = athletes.map((a) => ({
    value: a.id,
    label: `${a.firstName} ${a.lastName}`,
  }));

  const assessment = selectedAthleteId ? assessments[selectedAthleteId] : null;

  // Fetch recommendations when event changes
  async function fetchRecommendations(event: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/coach/throws/recommendations?event=${event}`);
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleEventChange(event: string) {
    setSelectedEvent(event);
    fetchRecommendations(event);
  }

  // Group recommendations by category in prescribed order
  const grouped = useMemo(() => {
    const groups: Record<string, ExerciseRec[]> = {};
    for (const cat of CATEGORY_ORDER) {
      groups[cat] = [];
    }
    for (const rec of recommendations) {
      if (groups[rec.category]) {
        groups[rec.category].push(rec);
      } else {
        groups[rec.category] = [rec];
      }
    }
    // Sort within each group by correlation descending
    for (const cat of Object.keys(groups)) {
      groups[cat].sort((a, b) => b.correlation - a.correlation);
    }
    return groups;
  }, [recommendations]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="card p-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <Select
            label="Athlete"
            options={athleteOptions}
            value={selectedAthleteId}
            onChange={(v) => setSelectedAthleteId(v)}
            placeholder="Select athlete…"
            searchable
            clearable
          />
          <Select
            label="Event"
            options={EVENT_OPTIONS}
            value={selectedEvent}
            onChange={handleEventChange}
            placeholder="Select event…"
          />
        </div>

        {/* Athlete assessment info */}
        {selectedAthleteId && (
          <div className="mt-4 pt-4 border-t border-[var(--card-border)] flex items-center gap-3 flex-wrap">
            {assessment ? (
              <>
                <span className="text-xs text-muted">Athlete Type:</span>
                <Badge variant={BONDARCHUK_COLORS[assessment.athleteType] ?? "neutral"}>
                  {assessment.athleteType.replace(/_/g, " ")}
                </Badge>
                <span className="text-xs text-muted">
                  Assessed {new Date(assessment.completedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted">
                No Bondarchuk assessment on file.{" "}
                <a
                  href={`/coach/throws/assessment/${selectedAthleteId}`}
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Run assessment →
                </a>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Recommendations */}
      {!selectedEvent ? (
        <div className="card p-12 text-center">
          <p className="text-sm text-muted">
            Select an event to see exercise recommendations sorted by correlation.
          </p>
        </div>
      ) : loading ? (
        <div className="card p-12 text-center">
          <p className="text-sm text-muted">Loading recommendations…</p>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-sm text-muted">
            No exercises have correlation data for {formatEventName(selectedEvent)}.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              Recommended (≥ 0.7)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Moderate (0.4–0.7)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              Low (&lt; 0.4)
            </span>
          </div>

          {CATEGORY_ORDER.map((cat) => {
            const exercises = grouped[cat];
            if (!exercises || exercises.length === 0) return null;

            return (
              <div key={cat} className="space-y-2">
                <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
                  {CATEGORY_LABELS[cat] ?? cat}
                </h3>
                <div className="card divide-y divide-[var(--card-border)]">
                  {exercises.map((ex) => {
                    const corr = ex.correlation;
                    const corrColor =
                      corr >= 0.7
                        ? "text-green-500"
                        : corr >= 0.4
                        ? "text-amber-500"
                        : "text-red-500";
                    const bgClass =
                      corr >= 0.7
                        ? "bg-green-500/5"
                        : corr >= 0.4
                        ? ""
                        : "bg-red-500/5";

                    return (
                      <div
                        key={ex.id}
                        className={`flex items-center justify-between px-4 py-3 ${bgClass}`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--foreground)]">
                              {ex.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <Badge variant="neutral">{ex.category}</Badge>
                              {ex.event && (
                                <span className="text-[10px] text-muted">
                                  {formatEventName(ex.event)}
                                </span>
                              )}
                              {ex.implementWeight && (
                                <span className="text-[10px] text-muted">
                                  {formatImplementWeight(ex.implementWeight)}
                                </span>
                              )}
                              {ex.equipment && (
                                <span className="text-[10px] text-muted">
                                  {ex.equipment}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {/* Correlation bar */}
                          <div className="hidden sm:flex items-center gap-2 w-32">
                            <div className="flex-1 h-1.5 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  corr >= 0.7
                                    ? "bg-green-500"
                                    : corr >= 0.4
                                    ? "bg-amber-500"
                                    : "bg-red-500"
                                }`}
                                style={{ width: `${Math.max(5, corr * 100)}%` }}
                              />
                            </div>
                          </div>
                          <span className={`text-sm font-bold tabular-nums ${corrColor}`}>
                            {corr.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
