"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Wand2, Pencil } from "lucide-react";
import { SessionWizard } from "../plans/new/_session-wizard";
import { ProgramBuilderWizard } from "../plans/generate/_program-builder-wizard";
import type { ExerciseItem, AthletePickerItem } from "@/lib/data/coach";

type Mode = "manual" | "generate";
const VALID_MODES: ReadonlyArray<Mode> = ["manual", "generate"];

interface PlanTabProps {
  userId: string;
  exercises: ExerciseItem[];
  athletes: AthletePickerItem[];
}

export function PlanTab({ userId, exercises, athletes }: PlanTabProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const mode: Mode = useMemo(() => {
    const requested = searchParams.get("mode");
    return VALID_MODES.includes(requested as Mode) ? (requested as Mode) : "manual";
  }, [searchParams]);

  const handleModeChange = useCallback(
    (next: Mode) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "manual") params.delete("mode");
      else params.set("mode", next);
      const qs = params.toString();
      router.replace(`/coach/builder${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg sm:text-xl font-heading font-bold text-[var(--foreground)]">
            Plan Builder
          </h2>
          <p className="text-sm text-muted mt-0.5">
            {mode === "manual"
              ? "Build a single-session template by hand."
              : "Generate a multi-week Bondarchuk program for an athlete."}
          </p>
        </div>

        <div
          className="inline-flex items-center bg-[var(--muted-bg)] p-1 rounded-lg shrink-0"
          role="tablist"
          aria-label="Plan builder mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "manual"}
            onClick={() => handleModeChange("manual")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              mode === "manual"
                ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
                : "text-muted hover:text-[var(--foreground)]"
            }`}
          >
            <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
            Manual
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "generate"}
            onClick={() => handleModeChange("generate")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              mode === "generate"
                ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
                : "text-muted hover:text-[var(--foreground)]"
            }`}
          >
            <Wand2 size={14} strokeWidth={1.75} aria-hidden="true" />
            Generate
          </button>
        </div>
      </div>

      {mode === "manual" ? (
        <SessionWizard userId={userId} exercises={exercises} athletes={athletes} />
      ) : (
        <ProgramBuilderWizard athletes={athletes} />
      )}
    </div>
  );
}
