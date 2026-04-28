"use client";

import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";

export type ExerciseInsightsData = {
  exercise: { name: string; implementKg: number | null };
  laneName: string | null;
  athleteFirstName: string;
  correlation: {
    coefficient: number;
    sampleSize: number | null;
    population: string | null;
    band: "LOW" | "MEDIUM" | "HIGH";
  } | null;
  prescribed: {
    throws: number | null;
    targetRpe: number | null;
    rest: string | null;
    cueFocus: string | null;
  };
  history: Array<{ date: string; label: string; distance: number; isCurrent: boolean }>;
  lastNote: { quote: string; authorLabel: string } | null;
  citations: ReadonlyArray<{ label: string; href: string | null }>;
};

type Args = {
  athleteId: string;
  exerciseId: string;
  contextSessionId: string;
  /** Set to false to keep the hook idle (e.g. while the sheet is closed). */
  enabled?: boolean;
};

type State =
  | { status: "idle"; data: null; error: null }
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: ExerciseInsightsData; error: null }
  | { status: "error"; data: null; error: string };

const IDLE: State = { status: "idle", data: null, error: null };

/**
 * Fetches exercise insights for the coach mobile inspector. Aborts in-flight
 * requests on unmount or when args change so closing the sheet mid-fetch
 * doesn't write into stale state.
 */
export function useExerciseInsights({
  athleteId,
  exerciseId,
  contextSessionId,
  enabled = true,
}: Args): State {
  const [state, setState] = useState<State>(IDLE);

  useEffect(() => {
    if (!enabled || !athleteId || !exerciseId || !contextSessionId) {
      setState(IDLE);
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading", data: null, error: null });

    const url = `/api/coach/sessions/${encodeURIComponent(contextSessionId)}/exercises/${encodeURIComponent(
      exerciseId
    )}/insights?athleteId=${encodeURIComponent(athleteId)}`;

    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const payload = (await res.json()) as
          | { success: true; data: ExerciseInsightsData }
          | { success: false; error: string };
        if (!res.ok || !payload.success) {
          const message =
            payload.success === false ? payload.error : `Request failed (${res.status})`;
          setState({ status: "error", data: null, error: message });
          return;
        }
        setState({ status: "ready", data: payload.data, error: null });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Network error — please try again";
        logger.warn("Exercise insights fetch failed", {
          context: "useExerciseInsights",
          error: err,
        });
        setState({ status: "error", data: null, error: message });
      });

    return () => controller.abort();
  }, [athleteId, exerciseId, contextSessionId, enabled]);

  return state;
}
