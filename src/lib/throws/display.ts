/**
 * Client-safe implement display utilities.
 *
 * This file has NO server-only imports (no prisma, no fs) so it can be
 * used in both Server Components and Client Components ("use client").
 */

/* ─── Competition Weights ────────────────────────────────────────────── */

const COMP_WEIGHTS: Record<string, Record<string, number>> = {
  SHOT_PUT: { MALE: 7.26, FEMALE: 4 },
  DISCUS: { MALE: 2, FEMALE: 1 },
  HAMMER: { MALE: 7.26, FEMALE: 4 },
  JAVELIN: { MALE: 0.8, FEMALE: 0.6 },
};

/* ─── Standard kg → lb Labels ────────────────────────────────────────── */

/**
 * Known kg → lb equivalents that coaches use in conversation.
 * Men's shot/hammer: "16lb" is more common than "7.26kg" in US coaching.
 */
const KG_TO_LB_LABELS: Record<number, string> = {
  15.88: "35lb",
  11.34: "25lb",
  9.07: "20lb",
  7.26: "16lb",
};

/* ─── Main Display Function ──────────────────────────────────────────── */

/**
 * Format an implement weight for coach-facing display.
 *
 * Rules:
 * - Always shows kg as primary: "7.26kg"
 * - For men's shot/hammer: adds lb equivalent: "7.26kg / 16lb"
 * - For competition weight: appends "comp" marker
 * - Women's implements: kg only (coaches don't use lbs for women's)
 * - Discus/Javelin: kg/g only (no lb convention)
 *
 * Examples:
 *   formatImplementDisplay(7.26, "SHOT_PUT", "MALE")          → "7.26kg / 16lb · comp"
 *   formatImplementDisplay(9, "SHOT_PUT", "MALE")             → "9kg"
 *   formatImplementDisplay(4, "HAMMER", "FEMALE")             → "4kg · comp"
 *   formatImplementDisplay(0.8, "JAVELIN", "MALE")            → "800g · comp"
 *   formatImplementDisplay(7.26, "SHOT_PUT", "MALE", {compact:true}) → "7.26kg / 16lb comp"
 */
export function formatImplementDisplay(
  weightKg: number | null | undefined,
  event?: string | null,
  gender?: string | null,
  options?: { showComp?: boolean; compact?: boolean },
): string {
  if (weightKg == null) return "—";

  const { showComp = true, compact = false } = options ?? {};

  // Primary label: kg (or grams for javelin)
  const isJavelin = event === "JAVELIN";
  let primary: string;
  if (isJavelin && weightKg < 2) {
    const grams = Math.round(weightKg * 1000);
    primary = `${grams}g`;
  } else {
    const display = parseFloat(weightKg.toFixed(2));
    primary = `${display}kg`;
  }

  // lb equivalent: men's shot/hammer only
  const normalizedGender = gender?.toUpperCase();
  const showLbs =
    normalizedGender === "MALE" &&
    (event === "SHOT_PUT" || event === "HAMMER");

  let lbSuffix = "";
  if (showLbs) {
    const knownLb = KG_TO_LB_LABELS[weightKg];
    if (knownLb) {
      lbSuffix = ` / ${knownLb}`;
    }
  }

  // Competition weight detection
  let compSuffix = "";
  if (showComp && event && normalizedGender) {
    const compWeight = COMP_WEIGHTS[event]?.[normalizedGender];
    if (compWeight != null && Math.abs(weightKg - compWeight) < 0.01) {
      compSuffix = compact ? " comp" : " · comp";
    }
  }

  return `${primary}${lbSuffix}${compSuffix}`;
}
