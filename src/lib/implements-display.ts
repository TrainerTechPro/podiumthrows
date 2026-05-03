/**
 * Implement catalog — client-safe display helpers and DTO types.
 *
 * Lives separately from `implements.ts` so client components (Implement
 * picker, edit sheet, history rows) don't pull Prisma into their bundles.
 * All exports here are pure functions / types.
 */

import type { ImplementType, ImplementCategory } from "@prisma/client";

/** Display-only representation of a catalog row. */
export interface ImplementDisplay {
  id: string;
  throwType: ImplementType;
  weightKg: number;
  weightLb: number;
  primaryUnit: string; // "kg" | "lb"
  displayLabel: string; // "14 lb", "7.26 kg", "600 g"
  shortLabel: string; // "14lb", "7.26kg", "600g"
  active?: boolean;
  sortOrder?: number;
  categories?: ImplementCategory[];
}

export const KG_PER_LB = 0.45359237;

/**
 * Format an implement label for display.
 *
 *   formatImplement(impl)                  → "14 lb"
 *   formatImplement(impl, { withType: true }) → "Hammer 14 lb"
 *   formatImplement(impl, { short: true }) → "14lb"
 */
export function formatImplement(
  impl: Pick<ImplementDisplay, "throwType" | "displayLabel" | "shortLabel">,
  opts: { withType?: boolean; short?: boolean } = {}
): string {
  const label = opts.short ? impl.shortLabel : impl.displayLabel;
  if (!opts.withType) return label;
  return `${prettyThrowType(impl.throwType)} ${label}`;
}

/** "HAMMER" → "Hammer". Pure capitalize for throw types. */
export function prettyThrowType(throwType: ImplementType): string {
  switch (throwType) {
    case "HAMMER":
      return "Hammer";
    case "SHOT":
      return "Shot";
    case "DISCUS":
      return "Discus";
    case "JAVELIN":
      return "Javelin";
    case "WEIGHT_THROW":
      return "Weight throw";
  }
}

/** "MEN_SENIOR" → "Men Senior". For category chips. */
export function prettyCategory(category: ImplementCategory): string {
  return category
    .toLowerCase()
    .split("_")
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");
}

/**
 * Group an implement list by primaryUnit for the picker UI.
 * Preserves catalog sortOrder within each group.
 */
export function groupImplementsByUnit<T extends Pick<ImplementDisplay, "primaryUnit">>(
  implements_: T[]
): { kg: T[]; lb: T[] } {
  const kg: T[] = [];
  const lb: T[] = [];
  for (const i of implements_) {
    if (i.primaryUnit === "lb") lb.push(i);
    else kg.push(i);
  }
  return { kg, lb };
}

/** True if the user-typed weight is on the lb grid (whole pounds within 0.01 lb). */
export function isOnLbGrid(weightKg: number): boolean {
  const lb = weightKg / KG_PER_LB;
  return Math.abs(lb - Math.round(lb)) < 0.01;
}

/** True if the user-typed weight is on the kg grid (multiples of 0.25 kg within 0.01 kg). */
export function isOnKgGrid(weightKg: number): boolean {
  const quarter = weightKg / 0.25;
  return Math.abs(quarter - Math.round(quarter)) < 0.01;
}
