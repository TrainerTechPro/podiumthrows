"use client";

import { useState } from "react";
import { Shield, ChevronDown, Wrench } from "lucide-react";
import type { ValidationResult, ValidationIssue } from "@/lib/throws/validation";

/* ─── Rule Metadata ──────────────────────────────────────────────── */

const ALL_RULES = [1, 2, 3, 4, 5, 6, 7] as const;

const RULE_META: Record<number, { title: string }> = {
  1: { title: "Implement Sequence" },
  2: { title: "CE Priority" },
  3: { title: "Strength Separation" },
  4: { title: "Weight Differential" },
  5: { title: "Minimum Throw Count" },
  6: { title: "Intensity Cap" },
  7: { title: "No Mixed Weights" },
};

/* ─── Status Helpers ─────────────────────────────────────────────── */

type RuleStatus = "OK" | "WN" | "XX";

function getRuleStatus(
  ruleNum: number,
  issues: ValidationIssue[]
): { status: RuleStatus; ruleIssues: ValidationIssue[] } {
  const ruleIssues = issues.filter((i) => i.rule === ruleNum);
  if (ruleIssues.length === 0) return { status: "OK", ruleIssues: [] };
  if (ruleIssues.some((i) => i.severity === "CRITICAL")) return { status: "XX", ruleIssues };
  return { status: "WN", ruleIssues };
}

const STATUS_STYLE: Record<RuleStatus, string> = {
  OK: "bg-success-500/10 text-success-600 dark:text-success-400",
  WN: "bg-primary-500/10 text-primary-600 dark:text-primary-400",
  XX: "bg-danger-500/10 text-danger-600 dark:text-danger-400 animate-danger-pulse",
};

/* ─── Scroll to Block ────────────────────────────────────────────── */

function scrollToBlock(index: number) {
  document
    .getElementById(`builder-block-${index}`)
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}

/* ─── Shared Panel Content ───────────────────────────────────────── */

function PanelContent({
  validation,
  onAutoFix,
}: {
  validation: ValidationResult;
  onAutoFix: () => void;
}) {
  const [expandedRule, setExpandedRule] = useState<number | null>(null);

  const ruleStatuses = ALL_RULES.map((ruleNum) => ({
    ruleNum,
    title: RULE_META[ruleNum].title,
    ...getRuleStatus(ruleNum, validation.issues),
  }));

  const passingCount = ruleStatuses.filter((r) => r.status === "OK").length;
  const hasAutoFixable = validation.issues.some((i) => i.autoFixable);

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--card-border)]">
        <Shield size={16} strokeWidth={1.75} className="text-primary-500" aria-hidden="true" />
        <span className="text-xs font-semibold text-muted uppercase tracking-wider flex-1">
          Session Validation
        </span>
        <span
          className={`text-xs font-bold tabular-nums ${
            passingCount === 7 ? "text-success-500" : "text-muted"
          }`}
        >
          {passingCount}/7
        </span>
      </div>

      {/* Rule rows */}
      <div className="divide-y divide-[var(--card-border)]">
        {ruleStatuses.map((rule) => {
          const isExpanded = expandedRule === rule.ruleNum;
          const hasDetails = rule.ruleIssues.length > 0;

          return (
            <div key={rule.ruleNum}>
              <button
                type="button"
                onClick={() => hasDetails && setExpandedRule(isExpanded ? null : rule.ruleNum)}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors ${
                  hasDetails
                    ? "hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer"
                    : "cursor-default"
                }`}
              >
                {/* Status badge */}
                <span
                  className={`text-nano font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    STATUS_STYLE[rule.status]
                  }`}
                >
                  {rule.status}
                </span>
                {/* Rule title */}
                <span className="text-sm text-[var(--foreground)] flex-1 truncate">
                  {rule.title}
                </span>
                {/* Expand chevron */}
                {hasDetails && (
                  <ChevronDown
                    size={14}
                    strokeWidth={1.75}
                    className={`text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                )}
              </button>

              {/* Expanded detail */}
              {isExpanded && rule.ruleIssues.length > 0 && (
                <div className="px-4 pb-3 pl-12 space-y-2">
                  {rule.ruleIssues.map((issue, i) => (
                    <div key={i}>
                      <p className="text-xs text-muted leading-relaxed">{issue.message}</p>
                      {issue.blockIndices && issue.blockIndices.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-nano text-muted">Blocks:</span>
                          {issue.blockIndices.map((idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                scrollToBlock(idx);
                              }}
                              className="text-nano font-bold px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-primary-500 hover:bg-primary-500/10 transition-colors"
                            >
                              #{idx + 1}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Auto-fix button */}
      {hasAutoFixable && (
        <div className="px-4 py-3 border-t border-[var(--card-border)]">
          <button
            type="button"
            onClick={onAutoFix}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-surface-100 dark:bg-surface-800 text-[var(--foreground)] hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
          >
            <Wrench size={14} strokeWidth={1.75} aria-hidden="true" />
            Auto-Fix Sequence
          </button>
        </div>
      )}
    </>
  );
}

/* ─── Desktop Validation Panel ───────────────────────────────────── */

export function ValidationPanel({
  validation,
  blockCount,
  onAutoFix,
}: {
  validation: ValidationResult;
  blockCount: number;
  onAutoFix: () => void;
}) {
  if (blockCount === 0) {
    return (
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={16} strokeWidth={1.75} className="text-muted" aria-hidden="true" />
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">
            Session Validation
          </span>
        </div>
        <p className="text-sm text-muted text-center py-4">Add blocks to see validation results</p>
      </div>
    );
  }

  return (
    <div className="card !p-0 overflow-hidden">
      <PanelContent validation={validation} onAutoFix={onAutoFix} />
    </div>
  );
}

/* ─── Mobile Validation Badge ────────────────────────────────────── */

export function ValidationBadge({
  validation,
  blockCount,
  onAutoFix,
}: {
  validation: ValidationResult;
  blockCount: number;
  onAutoFix: () => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  if (blockCount === 0) return null;

  const rulesWithIssues = new Set(validation.issues.map((i) => i.rule));
  const criticalCount = new Set(
    validation.issues.filter((i) => i.severity === "CRITICAL").map((i) => i.rule)
  ).size;
  const warningCount = rulesWithIssues.size - criticalCount;
  const okCount = 7 - rulesWithIssues.size;

  return (
    <>
      {/* Floating badge */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="fixed right-4 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-[var(--surface-overlay)] border border-[var(--card-border)] shadow-lg"
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {okCount > 0 && (
          <span className="flex items-center gap-1 text-xs font-bold text-success-500">
            <span className="w-2 h-2 rounded-full bg-success-500" />
            {okCount}
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex items-center gap-1 text-xs font-bold text-primary-500">
            <span className="w-2 h-2 rounded-full bg-primary-500" />
            {warningCount}
          </span>
        )}
        {criticalCount > 0 && (
          <span className="flex items-center gap-1 text-xs font-bold text-danger-500 animate-danger-pulse">
            <span className="w-2 h-2 rounded-full bg-danger-500" />
            {criticalCount}
          </span>
        )}
      </button>

      {/* Bottom sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setSheetOpen(false)} />
          {/* Sheet */}
          {/* Sheet content panel — --surface-overlay per CLAUDE.md §Overlay Surfaces. */}
          <div className="absolute bottom-0 left-0 right-0 bg-[var(--surface-overlay)] rounded-t-2xl border-t border-[var(--card-border)] max-h-[70vh] overflow-y-auto animate-fade-slide-in">
            <div className="pt-3 pb-4">
              <div className="w-10 h-1 rounded-full bg-surface-300 dark:bg-surface-600 mx-auto mb-2" />
              <PanelContent
                validation={validation}
                onAutoFix={() => {
                  onAutoFix();
                  setSheetOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
