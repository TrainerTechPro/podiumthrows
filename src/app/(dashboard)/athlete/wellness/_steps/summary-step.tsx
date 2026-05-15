"use client";

import { useEffect, useRef, useState } from "react";
import { Flame } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { StaggeredList } from "@/components/ui/StaggeredList";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { CheckinData, OuraSnapshot } from "./types";

/* ─── Props ─────────────────────────────────────────────────────────────── */

interface SummaryStepProps {
  score: number;
  streak: number;
  data: CheckinData;
  ouraData?: OuraSnapshot | null;
  onDone: () => void;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

const CIRCUMFERENCE = 408; // 2 * π * 65 ≈ 408

function scoreColor(v: number): string {
  if (v >= 8) return "var(--color-status-success-fg)";
  if (v >= 5) return "var(--color-status-warning-fg)";
  return "var(--color-status-danger-fg)";
}

function scoreLabel(v: number): { text: string; color: string } {
  if (v >= 8) return { text: "Great", color: "var(--color-status-success-fg)" };
  if (v >= 6) return { text: "Good to Go", color: "var(--color-status-success-fg)" };
  if (v >= 4) return { text: "Take It Easy", color: "var(--color-status-warning-fg)" };
  return { text: "Rest Day", color: "var(--color-status-danger-fg)" };
}

function valueColor(v: number): string {
  if (v >= 8) return "var(--color-status-success-fg)";
  if (v >= 5) return "var(--color-status-warning-fg)";
  return "var(--color-status-danger-fg)";
}

/* ─── Breakdown items ───────────────────────────────────────────────────── */

interface BreakdownItem {
  label: string;
  value: number;
}

function getBreakdown(data: CheckinData): BreakdownItem[] {
  return [
    { label: "Sleep", value: data.sleepQuality },
    { label: "Soreness", value: data.soreness },
    { label: "Stress", value: data.stressLevel },
    { label: "Energy", value: data.energyMood },
  ];
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export function SummaryStep({ score, streak, data, ouraData, onDone }: SummaryStepProps) {
  const reducedMotion = useRef(false);
  const hasFiredToast = useRef(false);
  const [offset, setOffset] = useState(CIRCUMFERENCE);
  const { celebration, success } = useToast();

  const color = scoreColor(score);
  const label = scoreLabel(score);
  const breakdown = getBreakdown(data);

  /* Check reduced motion preference on mount */
  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion.current) {
      /* Skip to final position immediately */
      setOffset(CIRCUMFERENCE - (CIRCUMFERENCE * score) / 10);
    } else {
      /* Animate ring after a brief delay */
      const timer = setTimeout(() => {
        setOffset(CIRCUMFERENCE - (CIRCUMFERENCE * score) / 10);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [score]);

  /* Confirm the save succeeded — celebration for high scores, plain toast
   * for everything else. Athletes who miss subtle visual changes still get
   * a notification.  */
  useEffect(() => {
    if (hasFiredToast.current) return;
    hasFiredToast.current = true;
    if (score >= 8) {
      celebration("Great Readiness!", {
        highlight: score.toFixed(1),
        description: "You're ready to perform",
      });
    } else {
      success("Check-in saved");
    }
  }, [score, celebration, success]);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* ── Title ──────────────────────────────────────────────────────── */}
      <p className="text-caption font-medium" style={{ color: "#52525b" }}>
        Your Readiness Score
      </p>

      {/* ── Score Ring ─────────────────────────────────────────────────── */}
      <div className="relative flex items-center justify-center">
        <svg viewBox="0 0 140 140" width={140} height={140}>
          <circle cx="70" cy="70" r="65" fill="none" stroke="#1a1a1e" strokeWidth={6} />
          <circle
            cx="70"
            cy="70"
            r="65"
            fill="none"
            strokeWidth={6}
            strokeLinecap="round"
            stroke={color}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{
              transition: reducedMotion.current ? "none" : "stroke-dashoffset 1s ease-out",
              transform: "rotate(-90deg)",
              transformOrigin: "center",
            }}
          />
        </svg>

        {/* Score number centered inside ring */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ color }}>
          <AnimatedNumber
            value={score}
            decimals={1}
            duration={1200}
            className="text-[40px] font-extrabold font-heading leading-none"
          />
        </div>
      </div>

      {/* ── Score Label ────────────────────────────────────────────────── */}
      <p className="text-base font-bold font-heading -mt-2" style={{ color: label.color }}>
        {label.text}
      </p>

      {/* ── Streak Badge ──────────────────────────────────────────────── */}
      {streak > 0 && (
        <div className="flex items-center gap-1.5" style={{ color: "#3f3f46" }}>
          <Flame size={14} strokeWidth={1.75} aria-hidden="true" />
          <span className="text-xs font-medium">{streak}-day streak</span>
        </div>
      )}

      {/* ── Breakdown Grid ────────────────────────────────────────────── */}
      <StaggeredList className="grid grid-cols-2 gap-3 w-full" staggerDelay={60}>
        {breakdown.map((item) => {
          const c = valueColor(item.value);
          const pct = (item.value / 10) * 100;

          return (
            <div
              key={item.label}
              className="rounded-[10px] p-[10px] border bg-[var(--card-bg)] border-[var(--card-border)]"
            >
              <p className="text-nano font-semibold uppercase tracking-wider leading-tight mb-1 text-muted">
                {item.label}
              </p>
              <p className="text-section font-bold font-heading leading-tight" style={{ color: c }}>
                {item.value}
              </p>
              {/* Mini progress bar */}
              <div className="mt-1.5 h-[3px] w-full rounded-full overflow-hidden bg-[var(--card-border)]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: c }}
                />
              </div>
            </div>
          );
        })}
      </StaggeredList>

      {/* ── Wearable Comparison ────────────────────────────────────────── */}
      {ouraData?.sleepScore != null && (
        <div className="flex items-center gap-2 rounded-xl bg-indigo-500/[0.08] border border-indigo-500/15 px-3 py-2 w-full">
          <span className="text-xs font-medium text-indigo-400 leading-snug">
            You: {data.sleepQuality}/10 sleep · Oura: {Math.round(ouraData.sleepScore)}/100
          </span>
        </div>
      )}

      {/* ── Done Button ───────────────────────────────────────────────── */}
      <Button
        variant="primary"
        size="lg"
        className="w-full rounded-xl min-h-[48px] text-sm font-bold text-black mt-2"
        onClick={onDone}
      >
        Done
      </Button>
    </div>
  );
}
