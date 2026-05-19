"use client";

import { ShieldCheck, Target } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { StaggeredList } from "@/components/ui/StaggeredList";
import type { ProfileData, TechnicalCue } from "./_types";

/* ─── Phase grouping helpers ──────────────────────────────────────────── */

const PHASE_ORDER = ["Winds/Entry", "Turns/Middle", "Finish/Release"] as const;

function groupCuesByPhase(cues: TechnicalCue[]): Map<string, TechnicalCue[]> {
  const map = new Map<string, TechnicalCue[]>();

  // Seed the map in display order
  for (const phase of PHASE_ORDER) {
    map.set(phase, []);
  }

  for (const cue of cues) {
    const existing = map.get(cue.phase);
    if (existing) {
      existing.push(cue);
    } else {
      // Unknown phase — append at end
      const arr = map.get(cue.phase) ?? [];
      arr.push(cue);
      map.set(cue.phase, arr);
    }
  }

  // Remove empty phases
  for (const [key, val] of map) {
    if (val.length === 0) map.delete(key);
  }

  return map;
}

/* ─── Component ───────────────────────────────────────────────────────── */

export function TabTechnical({ profile }: { profile: ProfileData }) {
  const data = profile.technicalProfile;

  return (
    <div className="space-y-6">
      {/* ── Managed badge ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <ShieldCheck className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
        <span>Managed by your coach</span>
      </div>

      {/* ── Empty state or content ───────────────────────────────────── */}
      {!data ? (
        <EmptyState
          icon={<Target size={24} strokeWidth={1.75} aria-hidden="true" />}
          title="No technical profile yet"
          description="Your coach hasn't set up your technical profile yet. This section will show your strengths, weaknesses, and coaching cues once they add it."
        />
      ) : (
        <div className="space-y-6">
          {/* ── Primary Limiter ────────────────────────────────────── */}
          {data.primaryLimiter && (
            <div className="card p-4 border-2 border-primary-400/30 dark:border-primary-600/30 bg-primary-50/50 dark:bg-primary-900/10">
              <p className="text-xs font-semibold text-primary-700 dark:text-primary-400 uppercase tracking-wider mb-1">
                Primary Limiter
              </p>
              <p className="text-sm text-[var(--foreground)]">{data.primaryLimiter}</p>
            </div>
          )}

          {/* ── Strengths ─────────────────────────────────────────── */}
          {data.strengths.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
                Strengths
              </h3>
              <div className="flex flex-wrap gap-2">
                {data.strengths.map((s, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-success-500/10 text-success-700 dark:text-success-400 border border-success-500/20"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Weaknesses ────────────────────────────────────────── */}
          {data.weaknesses.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
                Weaknesses
              </h3>
              <div className="flex flex-wrap gap-2">
                {data.weaknesses.map((w, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-primary-500/10 text-primary-700 dark:text-primary-400 border border-primary-500/20"
                  >
                    {i + 1}. {w}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Cues That Work ────────────────────────────────────── */}
          {data.cuesWork.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
                Cues That Work
              </h3>
              {Array.from(groupCuesByPhase(data.cuesWork)).map(([phase, cues]) => (
                <div key={phase} className="space-y-2">
                  <h4 className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider">
                    {phase}
                  </h4>
                  <StaggeredList className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {cues.map((cue, i) => (
                      <div key={i} className="card p-3 space-y-1">
                        <p className="text-sm font-medium text-[var(--foreground)]">{cue.cue}</p>
                        <p className="text-xs text-muted">{cue.why}</p>
                      </div>
                    ))}
                  </StaggeredList>
                </div>
              ))}
            </div>
          )}

          {/* ── Cues That Don't Work ──────────────────────────────── */}
          {data.cuesFail.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
                Cues That Don&apos;t Work
              </h3>
              <StaggeredList className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {data.cuesFail.map((cue, i) => (
                  <div
                    key={i}
                    className="card p-3 space-y-1 border border-danger-500/20 bg-danger-50/30 dark:bg-danger-900/10"
                  >
                    <p className="text-sm font-medium text-danger-700 dark:text-danger-400">
                      {cue.cue}
                    </p>
                    <p className="text-xs text-muted">{cue.why}</p>
                  </div>
                ))}
              </StaggeredList>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
