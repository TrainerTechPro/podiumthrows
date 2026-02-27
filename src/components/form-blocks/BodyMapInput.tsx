"use client";

import { BODY_REGIONS, SEVERITY_LABELS } from "@/lib/forms/constants";
import type { BodyMapBlock } from "@/lib/forms/types";
import type { BlockInputProps } from "./types";

type BodyMapAnswer = Array<{ region: string; severity?: number }>;

export function BodyMapInput({
  block,
  value,
  onChange,
  error,
  disabled,
}: BlockInputProps<BodyMapBlock>) {
  const selected: BodyMapAnswer = (value as BodyMapAnswer) ?? [];

  function toggleRegion(regionId: string) {
    if (disabled) return;
    const exists = selected.find((s) => s.region === regionId);
    if (exists) {
      onChange(selected.filter((s) => s.region !== regionId));
    } else {
      if (!block.allowMultiple && selected.length > 0) {
        onChange([
          { region: regionId, severity: block.severityScale ? 1 : undefined },
        ]);
      } else {
        onChange([
          ...selected,
          { region: regionId, severity: block.severityScale ? 1 : undefined },
        ]);
      }
    }
  }

  function setSeverity(regionId: string, severity: number) {
    onChange(
      selected.map((s) =>
        s.region === regionId ? { ...s, severity } : s
      )
    );
  }

  const selectedIds = new Set(selected.map((s) => s.region));

  const groups = [
    { label: "Upper Body", regions: BODY_REGIONS.filter((r) => r.group === "upper") },
    { label: "Core", regions: BODY_REGIONS.filter((r) => r.group === "core") },
    { label: "Lower Body", regions: BODY_REGIONS.filter((r) => r.group === "lower") },
  ];

  return (
    <div className="space-y-4">
      <p className="text-[10px] text-muted">
        Tap to select region{block.allowMultiple ? "s" : ""}
        {block.severityScale ? ", then rate severity" : ""}
      </p>

      {groups.map((group) => (
        <div key={group.label}>
          <h4 className="text-xs font-semibold text-muted mb-1.5">
            {group.label}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {group.regions.map((region) => {
              const isSelected = selectedIds.has(region.id);
              return (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => toggleRegion(region.id)}
                  disabled={disabled}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isSelected
                      ? "bg-red-500/15 text-red-600 dark:text-red-400 ring-1 ring-red-500/30"
                      : "border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-red-500/50"
                  }`}
                >
                  {region.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Severity ratings for selected regions */}
      {block.severityScale && selected.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-[var(--card-border)]">
          <h4 className="text-xs font-semibold text-muted">
            Rate severity (1-5)
          </h4>
          {selected.map((item) => {
            const region = BODY_REGIONS.find((r) => r.id === item.region);
            return (
              <div
                key={item.region}
                className="flex items-center gap-3 py-1"
              >
                <span className="text-xs text-[var(--foreground)] w-28 truncate">
                  {region?.label ?? item.region}
                </span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSeverity(item.region, n)}
                      disabled={disabled}
                      className={`w-7 h-7 rounded text-[10px] font-medium transition-colors disabled:opacity-50 ${
                        item.severity === n
                          ? n >= 4
                            ? "bg-red-500 text-white"
                            : n >= 3
                            ? "bg-amber-500 text-white"
                            : "bg-green-500 text-white"
                          : "border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-primary-500/50"
                      }`}
                      title={SEVERITY_LABELS[n]}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <p className="text-xs text-danger-500 dark:text-danger-400">{error}</p>
      )}
    </div>
  );
}
