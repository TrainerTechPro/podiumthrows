"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Sheet, useSheet } from "@/components/ui/Sheet";
import { Badge } from "@/components/ui/Badge";

export interface BadgeWithProgress {
  id: string;
  title: string;
  description: string;
  emoji: string;
  isEarned: boolean;
  earnedAt: string | null;
  progress: number;
  criteria: string;
  progressLabel: string;
  tip: string;
}

export interface AchievementCategory {
  label: string;
  badges: BadgeWithProgress[];
}

interface AchievementsGridProps {
  categories: AchievementCategory[];
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function formatEarnedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function stripEmoji(title: string): string {
  return title.replace(/[\uD800-\uDFFF☀-➿]/g, "").trim();
}

function BadgeCard({
  badge,
  onSelect,
}: {
  badge: BadgeWithProgress;
  onSelect: (b: BadgeWithProgress) => void;
}) {
  const pct = Math.round(clamp01(badge.progress) * 100);
  const earned = badge.isEarned;

  return (
    <button
      type="button"
      onClick={() => onSelect(badge)}
      className={`card group relative overflow-hidden p-4 flex flex-col items-center text-center gap-2 text-left transition-transform active:scale-[0.97] hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-amber-400/40 ${
        earned ? "ring-1 ring-amber-400/30 dark:ring-amber-500/20" : "border-dashed"
      }`}
      aria-label={
        earned
          ? `${stripEmoji(badge.title)} — earned`
          : `${stripEmoji(badge.title)} — ${pct}% complete, tap for details`
      }
    >
      {/* Emoji */}
      <div
        className={`text-4xl leading-none select-none transition-[filter] ${
          earned ? "" : "saturate-0 opacity-30 group-hover:opacity-40"
        }`}
        aria-hidden="true"
      >
        {badge.emoji}
      </div>

      {/* Title */}
      <p
        className={`text-xs font-semibold leading-snug ${
          earned ? "text-[var(--foreground)]" : "text-muted"
        }`}
      >
        {stripEmoji(badge.title)}
      </p>

      {/* Footer: earned date OR progress label */}
      <div className="mt-auto pt-1 w-full flex items-center justify-center min-h-[18px]">
        {earned ? (
          <Badge variant="success">
            {badge.earnedAt ? formatEarnedDate(badge.earnedAt) : "Earned"}
          </Badge>
        ) : (
          <span className="inline-flex items-center gap-1 text-nano text-muted/80 font-mono tabular-nums">
            <Lock size={10} strokeWidth={1.75} aria-hidden="true" className="opacity-60" />
            {badge.progressLabel}
          </span>
        )}
      </div>

      {/* Amber progress overlay (locked only) */}
      {!earned && (
        <div
          className="absolute bottom-0 left-0 right-0 h-1 bg-surface-100 dark:bg-surface-800/60"
          aria-hidden="true"
        >
          <div
            className="h-full bg-amber-500 transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </button>
  );
}

function BadgeDetailSheet({
  badge,
  open,
  onClose,
}: {
  badge: BadgeWithProgress | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!badge) {
    return (
      <Sheet open={open} onClose={onClose} side="bottom" size="md" ariaLabel="Badge details" />
    );
  }

  const pct = Math.round(clamp01(badge.progress) * 100);
  const earned = badge.isEarned;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      side="bottom"
      size="md"
      title={stripEmoji(badge.title)}
      description={badge.description}
    >
      <div className="space-y-5">
        {/* Hero */}
        <div className="flex flex-col items-center text-center gap-2 py-2">
          <div
            className={`text-6xl leading-none select-none ${earned ? "" : "saturate-0 opacity-40"}`}
            aria-hidden="true"
          >
            {badge.emoji}
          </div>
          {earned ? (
            <Badge variant="success">
              Earned{badge.earnedAt ? ` · ${formatEarnedDate(badge.earnedAt)}` : ""}
            </Badge>
          ) : (
            <span className="text-xs font-mono text-muted">{pct}% complete</span>
          )}
        </div>

        {/* Criteria */}
        <div className="space-y-1.5">
          <p className="text-nano uppercase tracking-wider text-muted font-semibold">
            How to earn it
          </p>
          <p className="text-sm text-[var(--foreground)] leading-relaxed">{badge.criteria}</p>
        </div>

        {/* Progress bar (locked only) */}
        {!earned && (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-nano uppercase tracking-wider text-muted font-semibold">
                Your progress
              </p>
              <p className="text-xs font-mono tabular-nums text-[var(--foreground)]">
                {badge.progressLabel}
              </p>
            </div>
            <div
              className="h-2 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${stripEmoji(badge.title)} progress`}
            >
              <div
                className="h-full bg-amber-500 transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Tip */}
        <div className="rounded-xl bg-surface-50 dark:bg-surface-900/60 border border-[var(--card-border)] px-4 py-3">
          <p className="text-nano uppercase tracking-wider text-muted font-semibold mb-1">
            {earned ? "Why it matters" : "Tip"}
          </p>
          <p className="text-sm text-[var(--foreground)] leading-relaxed">{badge.tip}</p>
        </div>
      </div>
    </Sheet>
  );
}

export function AchievementsGrid({ categories }: AchievementsGridProps) {
  const sheet = useSheet(false);
  const [selected, setSelected] = useState<BadgeWithProgress | null>(null);

  const handleSelect = (b: BadgeWithProgress) => {
    setSelected(b);
    sheet.onOpen();
  };

  return (
    <>
      {categories.map(({ label, badges }) => {
        if (badges.length === 0) return null;
        const sectionEarned = badges.filter((b) => b.isEarned).length;
        return (
          <section key={label} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wider">
                {label}
              </h2>
              <span className="text-xs text-muted tabular-nums">
                {sectionEarned} / {badges.length}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {badges.map((badge) => (
                <BadgeCard key={badge.id} badge={badge} onSelect={handleSelect} />
              ))}
            </div>
          </section>
        );
      })}

      <BadgeDetailSheet badge={selected} open={sheet.open} onClose={sheet.onClose} />
    </>
  );
}
