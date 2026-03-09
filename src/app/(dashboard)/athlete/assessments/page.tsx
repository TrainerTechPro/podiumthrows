import Link from "next/link";
import { Badge } from "@/components";
import { EmptyState } from "@/components/ui/EmptyState";
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

function athleteTypeBadgeVariant(
  type: string
): "primary" | "success" | "warning" | "info" {
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

function MetricCell({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit: string;
}) {
  if (value === null || value === undefined) return null;
  return (
    <div className="text-center">
      <p className="text-lg font-bold tabular-nums font-heading text-[var(--foreground)]">
        {value}
        <span className="text-xs font-normal text-muted ml-0.5">{unit}</span>
      </p>
      <p className="text-[10px] text-muted uppercase tracking-wide mt-0.5">
        {label}
      </p>
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
                    <p className="text-xs text-muted mt-0.5">
                      {formatTestType(record.testType)}
                    </p>
                  </div>
                  {record.distanceBandAtTest && (
                    <Badge variant="primary">
                      Band: {record.distanceBandAtTest}
                    </Badge>
                  )}
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 py-2">
                  <MetricCell
                    label="Comp. Mark"
                    value={record.competitionMark}
                    unit="m"
                  />
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
                  <MetricCell
                    label="Snatch"
                    value={record.snatchKg}
                    unit="kg"
                  />
                  <MetricCell label="Clean" value={record.cleanKg} unit="kg" />
                  <MetricCell
                    label="Body Weight"
                    value={record.bodyWeightKg}
                    unit="kg"
                  />
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
              <div
                key={assessment.id}
                className="card px-6 py-5 flex items-start gap-4"
              >
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
                    <Badge
                      variant={athleteTypeBadgeVariant(assessment.athleteType)}
                    >
                      {formatAthleteType(assessment.athleteType)}
                    </Badge>
                    <span className="text-xs text-muted">
                      {new Date(assessment.completedAt).toLocaleDateString(
                        "en-US",
                        {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        }
                      )}
                    </span>
                  </div>
                  {assessment.notes && (
                    <p className="text-sm text-muted mt-2 leading-relaxed">
                      {assessment.notes}
                    </p>
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
