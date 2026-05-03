"use client";

/**
 * Performance-test display formatter that respects the user's per-test
 * unit preferences. Drop-in replacement for `formatTestValueShort` from
 * performance-tests-display.ts at any client site that wants the unit pref
 * applied (vertical jump cm↔in, broad jump cm↔ft+in).
 *
 * Sprint times stay in seconds — no toggle.
 *
 * Returns a stable function reference per render (useCallback), safe to
 * use as a dep / pass to memoized children.
 */

import { useCallback } from "react";
import { useUnitPref } from "@/lib/units/provider";
import { formatBroadJump, formatVerticalJump } from "@/lib/units/convert";
import { formatTestValueShort } from "@/lib/performance-tests-display";

export function useTestValueFormatter() {
  const verticalPref = useUnitPref("verticalJump");
  const broadPref = useUnitPref("broadJump");

  return useCallback(
    (value: number, testType: { key: string; unit: string }): string => {
      if (testType.key === "vertical_jump" && testType.unit === "cm") {
        return formatVerticalJump(value, verticalPref.unit);
      }
      if (testType.key === "broad_jump" && testType.unit === "cm") {
        return formatBroadJump(value, broadPref.unit);
      }
      return formatTestValueShort(value, testType.unit);
    },
    [verticalPref.unit, broadPref.unit]
  );
}
