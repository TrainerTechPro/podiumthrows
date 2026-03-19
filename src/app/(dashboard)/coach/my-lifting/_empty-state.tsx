"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TISSUE_REMODELING_TEMPLATE } from "@/lib/lifting-templates/tissue-remodeling";

export function LiftingEmptyState() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLoadTemplate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/lifting/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: TISSUE_REMODELING_TEMPLATE.name,
          goals: TISSUE_REMODELING_TEMPLATE.goals,
          workoutsPerWeek: TISSUE_REMODELING_TEMPLATE.workoutsPerWeek,
          totalWeeks: TISSUE_REMODELING_TEMPLATE.totalWeeks,
          rpeTargets: TISSUE_REMODELING_TEMPLATE.rpeTargets,
          phases: TISSUE_REMODELING_TEMPLATE.phases,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create program");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 p-12">
      <div className="flex flex-col items-center text-center gap-4">
        <div className="text-surface-300 dark:text-surface-600">
          <Dumbbell size={48} strokeWidth={1.5} aria-hidden="true" />
        </div>

        <div className="max-w-sm">
          <h2 className="text-xl font-heading font-semibold text-surface-900 dark:text-surface-100">
            No lifting programs yet
          </h2>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1.5 leading-relaxed">
            Load a training template or create your own program to start
            tracking your lifting sessions.
          </p>
        </div>

        {error && (
          <p className="text-sm text-danger-500 mt-1">{error}</p>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
          <Button
            variant="primary"
            onClick={handleLoadTemplate}
            loading={loading}
            leftIcon={
              !loading ? (
                <Dumbbell size={16} strokeWidth={2} aria-hidden="true" />
              ) : undefined
            }
          >
            Load Tissue Remodeling Block
          </Button>
          <Button
            variant="outline"
            disabled
            title="Coming soon"
          >
            Create Custom Program
          </Button>
        </div>
      </div>
    </div>
  );
}
