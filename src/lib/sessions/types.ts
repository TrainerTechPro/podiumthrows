// Shared status + view types for the canonical session/throws routes.
// ThrowsAssignment.status is a free string at the DB level, so callers that
// need to branch on it should run the raw value through parseThrowsStatus and
// treat `null` as "unknown — fall through to the live view by default".

export type ThrowsAssignmentStatus =
  | "ASSIGNED"
  | "NOTIFIED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "PARTIAL"
  | "SKIPPED";

const THROWS_STATUSES: readonly string[] = [
  "ASSIGNED",
  "NOTIFIED",
  "IN_PROGRESS",
  "COMPLETED",
  "PARTIAL",
  "SKIPPED",
];

export function parseThrowsStatus(s: string | null | undefined): ThrowsAssignmentStatus | null {
  if (!s) return null;
  return THROWS_STATUSES.includes(s) ? (s as ThrowsAssignmentStatus) : null;
}

export function isThrowsRecapStatus(s: ThrowsAssignmentStatus | null): boolean {
  return s === "COMPLETED" || s === "PARTIAL" || s === "SKIPPED";
}

export type SessionView = "live" | "recap";

export function parseSessionView(s: string | string[] | null | undefined): SessionView | null {
  const v = Array.isArray(s) ? s[0] : s;
  return v === "live" || v === "recap" ? v : null;
}
