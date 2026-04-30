/**
 * Performance Tests — client-safe display helpers and DTO types.
 *
 * Lives separately from `performance-tests.ts` so client components don't pull
 * Prisma into their bundles. All exports here are pure functions / types.
 */

export const CM_TO_INCHES = 0.393701;

export function decimalsForUnit(unit: string): number {
  if (unit === "cm") return 1;
  if (unit === "sec") return 2;
  return 2;
}

export function cmToInches(cm: number): number {
  return cm * CM_TO_INCHES;
}

export function formatTestValue(
  value: number,
  unit: string,
  opts: { withAlt?: boolean } = {}
): string {
  const withAlt = opts.withAlt ?? true;
  if (unit === "cm") {
    const cmStr = value.toFixed(1);
    if (!withAlt) return `${cmStr} cm`;
    return `${cmStr} cm (${cmToInches(value).toFixed(1)}")`;
  }
  if (unit === "sec") {
    return `${value.toFixed(2)} s`;
  }
  return value.toFixed(2);
}

export function formatTestValueShort(value: number, unit: string): string {
  if (unit === "cm") return `${value.toFixed(1)} cm`;
  if (unit === "sec") return `${value.toFixed(2)} s`;
  return value.toFixed(2);
}

/* ── DTO shapes returned by the API ─────────────────────────────────────── */

export interface PerformanceTestTypeDTO {
  id: string;
  key: string;
  name: string;
  unit: string;
  lowerIsBetter: boolean;
  defaultAttempts: number;
  iconKey: string;
  sortOrder: number;
}

export interface PerformanceTestAttemptDTO {
  id: string;
  sessionId: string;
  attemptNumber: number;
  value: number;
  isValid: boolean;
  notes: string | null;
  lastEditedById: string | null;
  lastEditedAt: string | null;
  createdAt: string;
}

export interface PerformanceTestRecorderDTO {
  id?: string;
  coachProfile?: { firstName: string; lastName: string } | null;
  athleteProfile?: { firstName: string; lastName: string } | null;
}

export interface PerformanceTestSessionDTO {
  id: string;
  athleteId: string;
  testTypeId: string;
  performedAt: string;
  recordedById: string;
  recordedByRole: "ATHLETE" | "COACH";
  notes: string | null;
  conditions: string | null;
  peakValue: number | null;
  avgValue: number | null;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  testType?: PerformanceTestTypeDTO;
  attempts?: PerformanceTestAttemptDTO[];
  recordedBy?: PerformanceTestRecorderDTO;
}

export interface PerformanceTestTrendPointDTO {
  sessionId: string;
  performedAt: string;
  peak: number | null;
  avg: number | null;
  attemptCount: number;
  recordedByRole: "ATHLETE" | "COACH";
}

export function recordedByDisplayName(
  recordedBy: PerformanceTestRecorderDTO | null | undefined,
  recordedByRole: "ATHLETE" | "COACH"
): string {
  if (!recordedBy) return recordedByRole === "COACH" ? "Coach" : "Athlete";
  if (recordedByRole === "COACH" && recordedBy.coachProfile) {
    return `Coach ${recordedBy.coachProfile.firstName} ${recordedBy.coachProfile.lastName}`;
  }
  if (recordedByRole === "ATHLETE" && recordedBy.athleteProfile) {
    return `${recordedBy.athleteProfile.firstName} ${recordedBy.athleteProfile.lastName}`;
  }
  return recordedByRole === "COACH" ? "Coach" : "Athlete";
}
