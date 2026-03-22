"use client";

import { useMemo } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { IMPLEMENTS, type ThrowEvent, type Gender } from "@/lib/throws/constants";
import type { WizardFormState } from "../_wizard";

interface StepImplementsProps {
  form: WizardFormState;
  update: (field: string, value: unknown) => void;
  errors: Record<string, string>;
  existingImplements: string | null;
}

export function StepImplements({ form, update, errors, existingImplements }: StepImplementsProps) {
  // Get available implements based on event/gender
  const implementOptions = useMemo(() => {
    if (!form.event || !form.gender) return [];
    const eventKey = form.event as ThrowEvent;
    const genderKey = form.gender as Gender;
    return IMPLEMENTS[eventKey]?.[genderKey] ?? [];
  }, [form.event, form.gender]);

  // Parse existing implements from equipment inventory
  const preExisting = useMemo(() => {
    if (!existingImplements) return new Set<number>();
    try {
      const parsed = JSON.parse(existingImplements) as { weightKg: number }[];
      return new Set(parsed.map((i) => i.weightKg));
    } catch {
      return new Set<number>();
    }
  }, [existingImplements]);

  function toggleImplement(weightKg: number) {
    const current = form.selectedImplements;
    const next = current.includes(weightKg)
      ? current.filter((w) => w !== weightKg)
      : [...current, weightKg].sort((a, b) => b - a); // Keep descending order
    update("selectedImplements", next);
  }

  function selectAll() {
    const all = implementOptions.map((i) => i.weightKg).sort((a, b) => b - a);
    update("selectedImplements", all);
  }

  function clearAll() {
    update("selectedImplements", []);
  }

  return (
    <div className="space-y-4 p-1">
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-1">
          Available Implements
        </h2>
        <p className="text-body text-surface-700 dark:text-surface-300">
          Select the implements you have access to for training
        </p>
      </div>

      {implementOptions.length === 0 ? (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Select an event and gender first to see available implements.
          </p>
        </div>
      ) : (
        <>
          {/* Quick actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
            >
              Select All
            </button>
            <span className="text-xs text-muted">|</span>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-surface-700 dark:text-surface-300 hover:underline font-medium"
            >
              Clear
            </button>
          </div>

          {/* Implement checklist */}
          <div className="space-y-2">
            {implementOptions.map((impl) => {
              const isSelected = form.selectedImplements.includes(impl.weightKg);
              const isFromInventory = preExisting.has(impl.weightKg);
              return (
                <button
                  key={impl.weight}
                  type="button"
                  onClick={() => toggleImplement(impl.weightKg)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                    isSelected
                      ? "border-primary-500 bg-primary-50/50 dark:bg-primary-950/20"
                      : "border-[var(--card-border)] hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                      isSelected
                        ? "bg-primary-500 border-primary-500"
                        : "border-surface-300 dark:border-surface-600"
                    }`}
                  >
                    {isSelected && (
                      <Check size={14} strokeWidth={2.5} className="text-white" aria-hidden="true" />
                    )}
                  </div>

                  {/* Weight */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-medium text-sm text-[var(--foreground)]"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {impl.weightKg} kg
                      </span>
                      {impl.isCompetition && (
                        <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-[10px] font-semibold uppercase rounded">
                          Comp
                        </span>
                      )}
                      {isFromInventory && (
                        <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 text-[10px] font-semibold uppercase rounded">
                          Owned
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted">{impl.label}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Warning for < 2 implements */}
          {form.selectedImplements.length > 0 && form.selectedImplements.length < 2 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <AlertTriangle
                size={16}
                strokeWidth={1.75}
                className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Bondarchuk methodology works best with at least 2 implements (heavy + competition
                weight). Consider adding more for optimal training transfer.
              </p>
            </div>
          )}
        </>
      )}

      {errors.implements && (
        <p className="text-sm text-red-600 dark:text-red-400">{errors.implements}</p>
      )}
    </div>
  );
}
