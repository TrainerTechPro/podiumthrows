"use client";

import { useEffect, useRef, useState } from "react";
import { X, Play } from "lucide-react";
import { NumberFlow } from "@/components/ui/NumberFlow";

const DRILL_TYPE_LABEL: Record<string, string> = {
  STANDING: "Standing Throw",
  POWER_POSITION: "Power Position",
  HALF_TURN: "Half Turn",
  SOUTH_AFRICAN: "South African",
  GLIDE: "Glide",
  SPIN: "Spin",
  FULL_THROW: "Full Throw",
  OTHER: "Other",
};

const EVENT_LABEL: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
  OTHER: "Other",
};

const COUNTDOWN_SECONDS = 5;

export interface WatchNextRecommendation {
  id: string;
  title: string;
  drillType: string;
  event: string;
  duration: number;
  videoUrl: string;
}

interface Props {
  open: boolean;
  recommendations: WatchNextRecommendation[];
  /** Keywords pulled from recent coach feedback. Renders a "Because your coach mentioned X" hint. */
  focusKeywords?: string[];
  /**
   * Called when the athlete picks a card OR the countdown auto-advances.
   * `source` discriminates the analytics signal recorded server-side.
   */
  onSelect: (rec: WatchNextRecommendation, source: "recommendation" | "autoplay") => void;
  onDismiss: () => void;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function WatchNextOverlay({
  open,
  recommendations,
  focusKeywords = [],
  onSelect,
  onDismiss,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [paused, setPaused] = useState(false);
  const top = recommendations[0];
  const onSelectRef = useRef(onSelect);
  // Keep the latest onSelect in a ref so the countdown effect can stay
  // dependency-free — re-running on every parent render would reset the timer.
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Reset countdown each time the overlay opens with a fresh top suggestion.
  useEffect(() => {
    if (!open) return;
    setSecondsLeft(COUNTDOWN_SECONDS);
    setPaused(false);
  }, [open, top?.id]);

  // Tick the countdown. Auto-advance to the top suggestion at 0.
  useEffect(() => {
    if (!open || paused || !top) return;
    if (secondsLeft <= 0) {
      onSelectRef.current(top, "autoplay");
      return;
    }
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [open, paused, secondsLeft, top]);

  if (!open || recommendations.length === 0) return null;

  const reducedMotion = prefersReducedMotion();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Watch next"
      className="absolute inset-0 z-20 flex flex-col bg-[var(--surface-overlay)] text-[var(--foreground)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 sm:px-5 sm:pt-4 shrink-0">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Up next</p>
          {focusKeywords.length > 0 && (
            <p className="text-xs text-muted mt-0.5 truncate">
              Because your coach mentioned{" "}
              <span className="text-[var(--foreground)] font-medium">{focusKeywords[0]}</span>
              {focusKeywords.length > 1 && (
                <span className="text-muted"> +{focusKeywords.length - 1}</span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!reducedMotion && top && (
            <span aria-live="polite" className="text-xs text-muted font-mono tabular-nums">
              <span className="hidden sm:inline">Auto-play in </span>
              <NumberFlow value={Math.max(0, secondsLeft)} duration={250} />
              <span>s</span>
            </span>
          )}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss watch next"
            className="p-1.5 rounded-lg text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
          >
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 px-4 pb-4 sm:px-5 sm:pb-5 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 h-full">
          {recommendations.slice(0, 3).map((rec, i) => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              isTop={i === 0}
              countdownActive={i === 0 && !reducedMotion}
              secondsLeft={secondsLeft}
              onClick={() => onSelect(rec, "recommendation")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface CardProps {
  rec: WatchNextRecommendation;
  isTop: boolean;
  countdownActive: boolean;
  secondsLeft: number;
  onClick: () => void;
}

function RecommendationCard({ rec, isTop, countdownActive, secondsLeft, onClick }: CardProps) {
  // Width percentage of the countdown bar — counts down 5 → 0 over the 5s
  // window so the bar visually drains. CSS transitions handle the smooth fill.
  const fillPct =
    isTop && countdownActive ? Math.max(0, (secondsLeft / COUNTDOWN_SECONDS) * 100) : 100;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative card card-interactive p-0 overflow-hidden flex flex-col text-left ${
        isTop ? "ring-2 ring-primary-500/60" : ""
      }`}
    >
      {/* Thumbnail (no thumbnail field on DrillVideo — render a play glyph
          on the brand-tinted surface instead). */}
      <div className="relative aspect-video bg-black flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/20 via-transparent to-transparent" />
        <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center shadow-lg">
          <Play size={20} strokeWidth={1.75} className="text-black ml-0.5" aria-hidden="true" />
        </div>
        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono tabular-nums">
          {rec.duration.toFixed(1)}s
        </span>
        {isTop && (
          <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-primary-500 text-black text-[10px] font-bold uppercase tracking-wider">
            Next
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-3 flex-1 flex flex-col">
        <p className="text-sm font-semibold text-[var(--foreground)] line-clamp-2 leading-snug">
          {rec.title}
        </p>
        <div className="flex flex-wrap gap-1 mt-1.5">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300">
            {EVENT_LABEL[rec.event] ?? rec.event}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300">
            {DRILL_TYPE_LABEL[rec.drillType] ?? rec.drillType}
          </span>
        </div>
      </div>

      {/* Countdown progress bar — only on the top card. */}
      {isTop && countdownActive && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-200 dark:bg-surface-800">
          <div
            className="h-full bg-primary-500 transition-[width] duration-1000 ease-linear"
            style={{ width: `${fillPct}%` }}
          />
        </div>
      )}
    </button>
  );
}
