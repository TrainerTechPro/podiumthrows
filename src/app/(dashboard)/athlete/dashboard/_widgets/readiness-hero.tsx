"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Heart, ChevronRight, Moon, Flame, Brain, Zap } from "lucide-react";
import { AnimatedNumber } from "@/components";
import { cn } from "@/lib/utils";
import type { ReadinessData } from "@/lib/data/dashboard";

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  HELPERS                                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

function scoreColor(score: number) {
  if (score >= 8) return { ring: "#10b981", text: "text-emerald-600 dark:text-emerald-400", bg: "from-emerald-500/8 to-emerald-500/3 dark:from-emerald-500/12 dark:to-emerald-500/4" };
  if (score >= 5) return { ring: "#f59e0b", text: "text-amber-600 dark:text-amber-400", bg: "from-amber-500/8 to-amber-500/3 dark:from-amber-500/12 dark:to-amber-500/4" };
  return { ring: "#ef4444", text: "text-red-600 dark:text-red-400", bg: "from-red-500/8 to-red-500/3 dark:from-red-500/12 dark:to-red-500/4" };
}

function scoreLabel(score: number) {
  if (score >= 8) return "Excellent — Train Hard";
  if (score >= 6) return "Good — Stay Sharp";
  if (score >= 4) return "Moderate — Adjust Load";
  if (score >= 2) return "Low — Recovery Day";
  return "Very Low — Rest";
}

const FACTORS = [
  { key: "sleepQuality" as const, label: "Sleep", icon: Moon },
  { key: "soreness" as const, label: "Soreness", icon: Flame },
  { key: "stressLevel" as const, label: "Stress", icon: Brain },
  { key: "energyMood" as const, label: "Energy", icon: Zap },
];

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  ANIMATED RING                                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

function ReadinessRing({
  score,
  reducedMotion,
}: {
  score: number;
  reducedMotion: boolean;
}) {
  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score / 10;
  const dashOffset = circumference - progress * circumference;
  const { ring } = scoreColor(score);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-surface-200 dark:text-surface-700"
        />
        {/* Progress fill */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ring}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={
            reducedMotion
              ? { strokeDashoffset: dashOffset }
              : { strokeDashoffset: circumference }
          }
          animate={{ strokeDashoffset: dashOffset }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { type: "spring", damping: 20, stiffness: 100 }
          }
        />
      </svg>

      {/* Score inside ring */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatedNumber
          value={score}
          decimals={1}
          duration={reducedMotion ? 0 : 1200}
          className={cn(
            "text-3xl font-bold tabular-nums font-heading",
            scoreColor(score).text
          )}
        />
        <span className="text-[10px] text-muted uppercase tracking-wider font-semibold mt-0.5">
          / 10
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  FACTOR BAR                                                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

function FactorBar({
  label,
  value,
  icon: Icon,
  delay,
  reducedMotion,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  delay: number;
  reducedMotion: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (reducedMotion) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion]);

  const pct = (value / 10) * 100;
  const barColor =
    pct >= 70
      ? "bg-emerald-500"
      : pct >= 40
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div ref={ref} className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon
            size={13}
            strokeWidth={1.75}
            className="text-muted"
            aria-hidden="true"
          />
          <span className="text-xs font-medium text-[var(--foreground)]">
            {label}
          </span>
        </div>
        <span className="text-xs tabular-nums text-muted font-medium">
          {value}/10
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
        <div
          className={cn("h-full rounded-full", barColor)}
          style={{
            width: visible ? `${Math.min(pct, 100)}%` : "0%",
            transition: reducedMotion
              ? "none"
              : `width 600ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`,
          }}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  CHECKED-IN STATE                                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

function CheckedInView({ data }: { data: ReadinessData & { checkedIn: true; score: number } }) {
  const prefersReduced = useReducedMotion();
  const reducedMotion = !!prefersReduced;
  const score = data.score;
  const colors = scoreColor(score);

  return (
    <Link
      href="/athlete/wellness"
      className={cn(
        "card card-interactive block overflow-hidden",
        "bg-gradient-to-br",
        colors.bg
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Heart
            size={16}
            strokeWidth={1.75}
            className={colors.text}
            aria-hidden="true"
          />
          <span className="text-sm font-semibold text-muted uppercase tracking-wider">
            Readiness
          </span>
        </div>
        <span className="text-xs font-medium text-primary-500 flex items-center gap-0.5">
          History
          <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />
        </span>
      </div>

      {/* Score + Label */}
      <div className="flex items-center gap-5 px-5 py-3">
        <ReadinessRing score={score} reducedMotion={reducedMotion} />
        <div className="flex-1 min-w-0">
          <p className={cn("text-base font-semibold font-heading", colors.text)}>
            {scoreLabel(score)}
          </p>
          <p className="text-xs text-muted mt-1">
            Checked in today
          </p>
        </div>
      </div>

      {/* Factor Breakdown — 2x2 grid */}
      <div className="grid grid-cols-2 gap-x-5 gap-y-3 px-5 pb-5 pt-1">
        {FACTORS.map((factor, idx) => {
          const value = data[factor.key];
          if (value == null) return null;
          return (
            <FactorBar
              key={factor.key}
              label={factor.label}
              value={value}
              icon={factor.icon}
              delay={idx * 50}
              reducedMotion={reducedMotion}
            />
          );
        })}
      </div>
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  NOT-CHECKED-IN STATE                                                       */
/* ═══════════════════════════════════════════════════════════════════════════ */

function NotCheckedInView() {
  return (
    <div
      className={cn(
        "card relative overflow-hidden",
        "bg-gradient-to-br from-primary-500/10 via-amber-500/8 to-primary-500/5",
        "dark:from-primary-500/15 dark:via-amber-500/10 dark:to-primary-500/8"
      )}
    >
      {/* Pulsing glow overlay — CSS only */}
      <div
        className="absolute inset-0 rounded-[inherit] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(245,158,11,0.12) 0%, transparent 70%)",
          animation: "readiness-pulse 2s ease-in-out infinite",
        }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col items-center text-center px-5 py-8 gap-4">
        <div className="w-14 h-14 rounded-full bg-primary-500/15 dark:bg-primary-500/20 flex items-center justify-center">
          <Heart
            size={28}
            strokeWidth={1.75}
            className="text-primary-500"
            aria-hidden="true"
          />
        </div>

        <div>
          <p className="text-base font-semibold font-heading text-[var(--foreground)]">
            How are you feeling?
          </p>
          <p className="text-sm text-muted mt-1">
            Check in to unlock today&apos;s readiness score
          </p>
        </div>

        <Link
          href="/athlete/wellness"
          className={cn(
            "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg",
            "bg-primary-500 hover:bg-primary-600 text-white",
            "text-sm font-semibold",
            "transition-colors duration-150",
            "shadow-sm shadow-primary-500/20"
          )}
        >
          Check In Now
          <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
        </Link>
      </div>

      {/* CSS keyframes for glow pulse */}
      <style>{`
        @keyframes readiness-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.02); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes readiness-pulse {
            0%, 100% { opacity: 0.7; transform: none; }
          }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  MAIN EXPORT                                                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function ReadinessHeroWidget({ data }: { data: ReadinessData }) {
  if (data.checkedIn && data.score != null) {
    return (
      <CheckedInView
        data={data as ReadinessData & { checkedIn: true; score: number }}
      />
    );
  }

  return <NotCheckedInView />;
}
