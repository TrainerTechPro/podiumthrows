// ── Autoregulation Types ────────────────────────────────────────────────────
// Shared types for the autoregulation system across all timescales.

/** How the engine should behave when a trigger fires. */
export type AutoregMode = 'AUTO' | 'SUGGEST' | 'OFF';

/** The timescale key used to look up per-timescale settings. */
export type AutoregTimescale = 'weekToWeek' | 'blockToBlock' | 'programToProgram';

/** Result of resolving autoregulation settings for a given timescale. */
export interface AutoregDecision {
  /** Whether the trigger should proceed (false when mode is OFF). */
  shouldExecute: boolean;
  /** The resolved mode for this timescale. */
  mode: AutoregMode;
}
