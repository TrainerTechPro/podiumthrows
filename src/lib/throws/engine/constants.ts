// ── Training Engine Constants ────────────────────────────────────────
// Engine-specific constants (complements ../constants.ts)

import type { TrainingPhase } from "../constants";

// ── Gap 2: PAP Rest Intervals ───────────────────────────────────────

/** PAP-specific rest intervals in seconds between contrast blocks */
export const PAP_REST_SECONDS: Partial<Record<TrainingPhase, number>> = {
  TRANSMUTATION: 420, // 7 minutes
  REALIZATION: 480,   // 8 minutes
};
