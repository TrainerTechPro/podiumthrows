"use client";

import { useEffect } from "react";
import { markVisitedToday, migrateLegacyKeys } from "@/lib/pwa/install-counters";

/**
 * Stamps today's date into the unique-day set used by the install-prompt
 * gating logic. Mount on /athlete/dashboard only — that's the engagement
 * signal we care about. Renders nothing.
 */
export function PwaVisitTracker() {
  useEffect(() => {
    migrateLegacyKeys();
    markVisitedToday();
  }, []);
  return null;
}
