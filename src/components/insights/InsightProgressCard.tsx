import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";
import type { InsightProgress } from "@/lib/insights/progress";

/* ─── Insight Progress Card ─────────────────────────────────────────────────
   Replaces the vague "typically after a few weeks" empty state with a
   concrete progress diagnostic — one row per (analyzer × event) showing
   actual vs required counts so athletes can see exactly what's needed.
   ──────────────────────────────────────────────────────────────────────── */

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

type Row = {
  label: string;
  current: number;
  required: number;
};

function ProgressRow({ row }: { row: Row }) {
  const pct = Math.min(100, Math.round((row.current / row.required) * 100));
  const unlocked = row.current >= row.required;
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <span className="text-sm text-[var(--foreground)] truncate">{row.label}</span>
          <span
            className={
              "text-xs tabular-nums shrink-0 " +
              (unlocked
                ? "text-[var(--color-status-success-fg)] font-semibold"
                : "text-[var(--color-text-secondary)]")
            }
          >
            {unlocked ? (
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 size={12} strokeWidth={2} aria-hidden="true" />
                Ready
              </span>
            ) : (
              `${row.current} of ${row.required}`
            )}
          </span>
        </div>
        <div
          className="h-1.5 w-full rounded-full bg-[var(--color-bg-surface-sunken)] overflow-hidden"
          role="progressbar"
          aria-valuenow={row.current}
          aria-valuemax={row.required}
          aria-label={row.label}
        >
          <div
            className="h-full rounded-full bg-[var(--color-brand)] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, rows }: { title: string; subtitle?: string; rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)] mb-1">
        {title}
      </h3>
      {subtitle && (
        <p className="text-[11px] text-[var(--color-text-secondary)] opacity-80 mb-2">{subtitle}</p>
      )}
      <div className="divide-y divide-[var(--card-border)]">
        {rows.map((r) => (
          <ProgressRow key={r.label} row={r} />
        ))}
      </div>
    </section>
  );
}

export function InsightProgressCard({ progress }: { progress: InsightProgress }) {
  const eventLabel = (ev: string) => EVENT_LABELS[ev] ?? ev;

  const trainingRows: Row[] = progress.events.map((ev) => ({
    label: eventLabel(ev),
    current: progress.trainingPattern.sessionsByEvent[ev] ?? 0,
    required: progress.trainingPattern.required,
  }));

  const readinessRows: Row[] = progress.events.map((ev) => ({
    label: eventLabel(ev),
    current: progress.readinessCompetition.meetsByEvent[ev] ?? 0,
    required: progress.readinessCompetition.required,
  }));

  const liftThrowRows: Row[] = [
    {
      label: "Paired training months",
      current: progress.liftThrow.pairedWindows,
      required: progress.liftThrow.required,
    },
  ];

  return (
    <div className="card mx-auto max-w-xl p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-[var(--color-brand-subtle)] flex items-center justify-center shrink-0">
          <Sparkles
            size={18}
            strokeWidth={1.75}
            className="text-[var(--color-brand-strong)]"
            aria-hidden="true"
          />
        </div>
        <div>
          <h2 className="font-heading text-lg font-semibold text-[var(--foreground)]">
            No insights yet
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Each insight type needs enough data to be statistically meaningful. Here&apos;s where
            you stand.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <Section
          title="Training patterns"
          subtitle="Which drills correlate with your best marks"
          rows={trainingRows}
        />
        <Section
          title="Readiness → meet outcomes"
          subtitle="Which wellness factors predict your competition marks"
          rows={readinessRows}
        />
        <Section
          title="Lift → throw"
          subtitle="How rep-max gains track with throwing distance (28-day windows)"
          rows={liftThrowRows}
        />
      </div>

      <div className="pt-2 border-t border-[var(--card-border)] flex flex-wrap gap-3">
        <Link
          href="/athlete/log-session"
          className="text-sm font-medium text-[var(--color-brand-strong)] hover:underline"
        >
          Log a practice session →
        </Link>
        <Link
          href="/athlete/competitions"
          className="text-sm font-medium text-[var(--color-brand-strong)] hover:underline"
        >
          Log a competition →
        </Link>
      </div>
    </div>
  );
}
