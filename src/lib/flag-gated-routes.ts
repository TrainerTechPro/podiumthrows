import type { FlagKey } from "@/lib/flags";

/**
 * Route prefixes that the edge middleware redirects when the flag is off.
 * See src/middleware.ts (Feature flag gating block) and
 * tasks/navigation-contract-2026-05-18.md.
 *
 * Exported as its own module so the regression test can import it without
 * pulling in the middleware's Edge runtime dependencies.
 */
export const FLAG_GATED_ROUTES: { prefix: string; flag: FlagKey }[] = [
  { prefix: "/athlete/self-program", flag: "selfProgram" },
  { prefix: "/coach/videos", flag: "videoAnnotator" },
  { prefix: "/coach/video-analysis", flag: "videoAnalysis" },
  { prefix: "/coach/architect", flag: "aiArchitect" },
  { prefix: "/coach/sideline", flag: "coachSideline" },
  { prefix: "/athlete/throws/trends", flag: "throwsAnalysis" },
  { prefix: "/athlete/oura", flag: "ouraIntegration" },
  { prefix: "/athlete/whoop", flag: "whoopIntegration" },
  { prefix: "/coach/questionnaires", flag: "questionnaireBuilder" },
  { prefix: "/athlete/questionnaires", flag: "questionnaireBuilder" },
  { prefix: "/coach/throws/practice", flag: "practiceMode" },
];
