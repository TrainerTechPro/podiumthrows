/**
 * Parse a string value from a React number input into a number or null.
 *
 * Distinguishes "empty" (→ null) from "zero" (→ 0) — unlike `parseFloat(x) || null`
 * which silently destroys legitimate zero values (bodyweight reps, 0-RPE recovery
 * days, unweighted implement drills). See CLAUDE.md §3.
 */
export function parseNumericInput(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Integer variant — same semantics, uses `parseInt` with base 10. */
export function parseIntegerInput(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}
