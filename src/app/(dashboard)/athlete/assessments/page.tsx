import Link from "next/link";
import { Badge } from "@/components";
import { EmptyState } from "@/components/ui/EmptyState";
import { MiniSparkline, type MiniSparklinePoint } from "@/components/charts/MiniSparkline";
import { requireAthleteSession } from "@/lib/data/athlete";
import prisma from "@/lib/prisma";

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function formatTestDate(dateStr: string): string {
  // dateStr is YYYY-MM-DD
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTestType(type: string): string {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatAthleteType(type: string): string {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function athleteTypeBadgeVariant(type: string): "primary" | "success" | "warning" | "info" {
  switch (type) {
    case "EXPLOSIVE":
      return "warning";
    case "SPEED_STRENGTH":
      return "primary";
    case "STRENGTH_SPEED":
      return "info";
    case "STRENGTH":
      return "success";
    default:
      return "primary";
  }
}

/* ─── Metric Cell ──────────────────────────────────────────────────────────── */

function MetricCell({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="text-center">
      <p className="text-lg font-bold tabular-nums font-heading text-[var(--foreground)]">
        {value}
        <span className="text-xs font-normal text-muted ml-0.5">{unit}</span>
      </p>
      <p className="text-[10px] text-muted uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}

/* ─── Trend helpers ────────────────────────────────────────────────────────── */

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function parseTestDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDelta(delta: number, unit: string): string {
  const abs = Math.abs(delta);
  // 1 decimal for distances (m), whole numbers for kg
  const formatted =
    unit === "m" ? abs.toFixed(2) : Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
  if (delta === 0) return `0${unit}`;
  return `${delta > 0 ? "+" : "−"}${formatted}${unit}`;
}

function formatBaselineAge(baselineDate: string): string {
  const days = Math.round(
    (Date.now() - parseTestDate(baselineDate).getTime()) / (24 * 60 * 60 * 1000)
  );
  if (days < 120) return "vs 90d";
  if (days < 365) return `vs ${Math.round(days / 30)}mo`;
  return `vs ${(days / 365).toFixed(1)}y`;
}

interface MetricTrend {
  history: MiniSparklinePoint[];
  delta: { value: number; baselineDate: string } | null;
}

function buildTrend(history: MiniSparklinePoint[]): MetricTrend {
  if (history.length === 0) return { history: [], delta: null };
  // history is desc (newest first). Find newest record older than 90 days.
  const cutoff = Date.now() - NINETY_DAYS_MS;
  const baseline = history.find((p) => parseTestDate(p.date).getTime() <= cutoff);
  const latest = history[0];
  const delta = baseline
    ? { value: latest.value - baseline.value, baselineDate: baseline.date }
    : null;
  // Sparkline takes oldest→newest, last 4 entries.
  const sparkData = history.slice(0, 4).reverse();
  return { history: sparkData, delta };
}

/* ─── Delta chip ───────────────────────────────────────────────────────────── */

function DeltaChip({
  delta,
  unit,
  baselineDate,
}: {
  delta: number | null;
  unit: string;
  baselineDate: string | null;
}) {
  if (delta === null || baselineDate === null) {
    return (
      <span className="inline-flex items-center text-[10px] font-mono text-muted/60 px-1.5 py-0.5">
        no 90d baseline
      </span>
    );
  }
  const tone =
    delta > 0
      ? "text-success-500 bg-success-500/10"
      : delta < 0
        ? "text-danger-500 bg-danger-500/10"
        : "text-muted bg-surface-100 dark:bg-surface-800/60";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded-md ${tone}`}
      title={`Baseline: ${baselineDate}`}
    >
      {formatDelta(delta, unit)}
      <span className="font-normal opacity-70">{formatBaselineAge(baselineDate)}</span>
    </span>
  );
}

/* ─── Snapshot tile ────────────────────────────────────────────────────────── */

function SnapshotTile({
  label,
  value,
  unit,
  trend,
}: {
  label: string;
  value: number | null;
  unit: string;
  trend: MetricTrend;
}) {
  if (value === null) return null;
  return (
    <div className="card px-4 py-3 flex flex-col gap-2 min-w-0">
      <p className="text-[10px] text-muted uppercase tracking-wider truncate">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold font-heading tabular-nums text-[var(--foreground)]">
          {value}
        </span>
        <span className="text-xs font-normal text-muted">{unit}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <MiniSparkline
          data={trend.history}
          width={88}
          height={32}
          ariaLabel={`${label} trend across ${trend.history.length} tests`}
        />
        <DeltaChip
          delta={trend.delta?.value ?? null}
          unit={unit}
          baselineDate={trend.delta?.baselineDate ?? null}
        />
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default async function AthleteAssessmentsPage() {
  const { athlete } = await requireAthleteSession();

  const [testingRecords, assessments] = await Promise.all([
    prisma.throwsTestingRecord.findMany({
      where: { athleteId: athlete.id },
      orderBy: { testDate: "desc" },
      select: {
        id: true,
        testDate: true,
        testType: true,
        competitionMark: true,
        heavyImplMark: true,
        heavyImplKg: true,
        lightImplMark: true,
        lightImplKg: true,
        squatKg: true,
        benchKg: true,
        snatchKg: true,
        cleanKg: true,
        bodyWeightKg: true,
        distanceBandAtTest: true,
        notes: true,
      },
    }),
    prisma.bondarchukAssessment.findMany({
      where: { athleteId: athlete.id },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        athleteType: true,
        completedAt: true,
        notes: true,
      },
    }),
  ]);

  const isEmpty = testingRecords.length === 0 && assessments.length === 0;

  /* Build per-metric history for the snapshot. testingRecords is desc by testDate. */
  const latest = testingRecords[0] ?? null;

  const buildHistoryFor = (
    field: "competitionMark" | "squatKg" | "benchKg" | "snatchKg" | "cleanKg" | "bodyWeightKg"
  ): MiniSparklinePoint[] =>
    testingRecords
      .map((r) => ({ date: r.testDate, value: r[field] }))
      .filter((p): p is MiniSparklinePoint => p.value !== null && p.value !== undefined);

  // Heavy/light history is only comparable when implement weight matches the latest entry.
  const buildImplementHistory = (
    markField: "heavyImplMark" | "lightImplMark",
    kgField: "heavyImplKg" | "lightImplKg"
  ): { history: MiniSparklinePoint[]; kg: number | null } => {
    const latestKg =
      testingRecords.find((r) => r[markField] !== null && r[kgField] !== null)?.[kgField] ?? null;
    if (latestKg === null) return { history: [], kg: null };
    const history = testingRecords
      .filter((r) => r[markField] !== null && r[kgField] === latestKg)
      .map((r) => ({ date: r.testDate, value: r[markField] as number }));
    return { history, kg: latestKg };
  };

  const compTrend = buildTrend(buildHistoryFor("competitionMark"));
  const heavy = buildImplementHistory("heavyImplMark", "heavyImplKg");
  const heavyTrend = buildTrend(heavy.history);
  const light = buildImplementHistory("lightImplMark", "lightImplKg");
  const lightTrend = buildTrend(light.history);
  const squatTrend = buildTrend(buildHistoryFor("squatKg"));
  const benchTrend = buildTrend(buildHistoryFor("benchKg"));
  const snatchTrend = buildTrend(buildHistoryFor("snatchKg"));
  const cleanTrend = buildTrend(buildHistoryFor("cleanKg"));
  const bwTrend = buildTrend(buildHistoryFor("bodyWeightKg"));

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/athlete/dashboard"
          className="w-9 h-9 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors shrink-0"
          aria-label="Back to dashboard"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            Testing & Assessment History
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Your testing records and Bondarchuk athlete classifications
          </p>
        </div>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="card">
          <EmptyState
            icon={
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
                <path d="M9 14l2 2 4-4" />
              </svg>
            }
            title="No assessments yet"
            description="Your coach will schedule testing sessions to track your progress. Results will appear here once recorded."
          />
        </div>
      )}

      {/* Snapshot — latest values with trend */}
      {latest && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Latest Snapshot
            </h2>
            <p className="text-xs text-muted">{formatTestDate(latest.testDate)}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <SnapshotTile
              label="Competition"
              value={latest.competitionMark}
              unit="m"
              trend={compTrend}
            />
            {heavy.kg !== null && (
              <SnapshotTile
                label={`Heavy ${heavy.kg}kg`}
                value={latest.heavyImplKg === heavy.kg ? latest.heavyImplMark : null}
                unit="m"
                trend={heavyTrend}
              />
            )}
            {light.kg !== null && (
              <SnapshotTile
                label={`Light ${light.kg}kg`}
                value={latest.lightImplKg === light.kg ? latest.lightImplMark : null}
                unit="m"
                trend={lightTrend}
              />
            )}
            <SnapshotTile label="Squat" value={latest.squatKg} unit="kg" trend={squatTrend} />
            <SnapshotTile label="Bench" value={latest.benchKg} unit="kg" trend={benchTrend} />
            <SnapshotTile label="Snatch" value={latest.snatchKg} unit="kg" trend={snatchTrend} />
            <SnapshotTile label="Clean" value={latest.cleanKg} unit="kg" trend={cleanTrend} />
            <SnapshotTile
              label="Body Weight"
              value={latest.bodyWeightKg}
              unit="kg"
              trend={bwTrend}
            />
          </div>
        </section>
      )}

      {/* Testing Records Timeline */}
      {testingRecords.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Testing Records
          </h2>

          <div className="space-y-4">
            {testingRecords.map((record) => (
              <div key={record.id} className="card px-6 py-5 space-y-4">
                {/* Date and type header */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-base font-semibold font-heading text-[var(--foreground)]">
                      {formatTestDate(record.testDate)}
                    </p>
                    <p className="text-xs text-muted mt-0.5">{formatTestType(record.testType)}</p>
                  </div>
                  {record.distanceBandAtTest && (
                    <Badge variant="primary">Band: {record.distanceBandAtTest}</Badge>
                  )}
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 py-2">
                  <MetricCell label="Comp. Mark" value={record.competitionMark} unit="m" />
                  {record.heavyImplMark !== null && (
                    <MetricCell
                      label={`Heavy (${record.heavyImplKg ?? "?"}kg)`}
                      value={record.heavyImplMark}
                      unit="m"
                    />
                  )}
                  {record.lightImplMark !== null && (
                    <MetricCell
                      label={`Light (${record.lightImplKg ?? "?"}kg)`}
                      value={record.lightImplMark}
                      unit="m"
                    />
                  )}
                  <MetricCell label="Squat" value={record.squatKg} unit="kg" />
                  <MetricCell label="Bench" value={record.benchKg} unit="kg" />
                  <MetricCell label="Snatch" value={record.snatchKg} unit="kg" />
                  <MetricCell label="Clean" value={record.cleanKg} unit="kg" />
                  <MetricCell label="Body Weight" value={record.bodyWeightKg} unit="kg" />
                </div>

                {/* Notes */}
                {record.notes && (
                  <div className="pt-3 border-t border-[var(--card-border)]">
                    <p className="text-xs text-muted mb-1">Notes</p>
                    <p className="text-sm text-[var(--foreground)] leading-relaxed">
                      {record.notes}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Bondarchuk Assessments */}
      {assessments.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Bondarchuk Assessments
          </h2>

          <div className="space-y-3">
            {assessments.map((assessment) => (
              <div key={assessment.id} className="card px-6 py-5 flex items-start gap-4">
                {/* Type icon */}
                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center shrink-0">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-primary-500"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={athleteTypeBadgeVariant(assessment.athleteType)}>
                      {formatAthleteType(assessment.athleteType)}
                    </Badge>
                    <span className="text-xs text-muted">
                      {new Date(assessment.completedAt).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  {assessment.notes && (
                    <p className="text-sm text-muted mt-2 leading-relaxed">{assessment.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
