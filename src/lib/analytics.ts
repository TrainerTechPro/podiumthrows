/**
 * Product analytics — thin typed wrapper around @vercel/analytics.
 *
 * Why a wrapper and not a direct `track()` call at every site:
 *   1. Centralized event catalog. Every event this app emits is listed in
 *      EVENT_SCHEMAS below. The reference page at /internal/analytics-events
 *      renders straight from this object — one source of truth.
 *   2. Typed payloads. Each event has a schema; the compiler refuses typos
 *      in event name or bad property keys.
 *   3. Swap-out cost. If you ever replace the underlying vendor (PostHog,
 *      Plausible, Segment, GA4 with consent), you edit this file — not
 *      the 20+ call sites.
 *   4. Dev visibility. In development, every emit also console.logs, so
 *      you can spot missing wires without opening a vendor dashboard.
 *
 * Naming convention: snake_case, verb-led, past tense for completed actions
 * ("throw_logged", "session_saved"). Matches GA4 / Amplitude conventions,
 * so adding a GA4 mirror later is mechanical.
 */

import { track as vercelTrack } from "@vercel/analytics";
import { logger } from "@/lib/logger";

/* ─── Event catalog ───────────────────────────────────────────────────── */

/**
 * Every event this app is allowed to emit. Add new events here — the call
 * sites and the reference page both pick them up automatically.
 *
 * Payload types use primitives only (string | number | boolean | null),
 * which matches @vercel/analytics' AllowedPropertyValues constraint.
 */
export const EVENT_SCHEMAS = {
  /** Scroll-depth milestones on long editorial pages. Fires once per
   *  milestone per page load. See components/analytics/ScrollDepthTracker. */
  scroll_depth: {
    description: "Reader scrolled to a 25/50/75/100 milestone on a public page.",
    surface: "public",
    props: {
      percent: "25 | 50 | 75 | 100",
      path: "string — window.location.pathname at emit time",
    },
  },

  /** A single throw entered via Quick Log or the full session logger. */
  throw_logged: {
    description: "Athlete saved a throw (Quick Log or session wizard).",
    surface: "athlete",
    props: {
      event: 'string — "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN"',
      implementKg: "number",
      distanceM: "number",
      source: '"quick_log" | "session_wizard" | "live_block"',
    },
  },

  /** A training session saved end-to-end. Fires once per save, not per throw. */
  session_saved: {
    description: "A full training session was saved.",
    surface: "athlete",
    props: {
      sessionType: '"throws" | "lift" | "mixed"',
      isEdit: "boolean — true when editing an existing session",
      throwCount: "number",
    },
  },

  /** A new PR was detected and the celebration surfaced. */
  pr_celebrated: {
    description: "A PR was detected and the celebration toast/overlay shown.",
    surface: "athlete",
    props: {
      event: 'string — "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN"',
      distanceM: "number",
      isCompetition: "boolean",
    },
  },

  /** Coach filtered their roster by any facet. Fires on facet change, not
   *  on every keystroke — debounce at the call site. */
  roster_filtered: {
    description: "Coach changed a roster filter facet.",
    surface: "coach",
    props: {
      facet: '"event" | "group" | "status" | "search"',
      hasValue: "boolean — true when filter is active, false when cleared",
    },
  },

  /** Coach searched the exercise library. Debounced at 300ms. */
  exercise_searched: {
    description: "Coach executed an exercise library search.",
    surface: "coach",
    props: {
      queryLength: "number — raw length, never the query text",
      resultCount: "number",
    },
  },

  /** Coach published a programming plan. */
  plan_published: {
    description: "Coach published a training plan.",
    surface: "coach",
    props: {
      planType: '"session" | "program" | "bondarchuk"',
      weekCount: "number",
    },
  },

  /** Coach sent an athlete invite. */
  invite_sent: {
    description: "Coach sent an invite link or email to an athlete.",
    surface: "coach",
    props: {
      method: '"link_copy" | "email"',
    },
  },

  /** User posted a comment on any training surface. */
  comment_sent: {
    description: "Comment (text or voice) posted on any training surface.",
    surface: "athlete",
    props: {
      targetField:
        '"throwLogId" | "practiceAttemptId" | "trainingSessionId" | "throwsAssignmentId" | "athleteDrillLogId" | "videoAnalysisId"',
      hasAudio: "boolean",
      role: '"COACH" | "ATHLETE"',
    },
  },

  /** User marked a thread as read (debounced after the Sheet opens). */
  comment_read: {
    description: "Thread marked as read via the mark-thread-read endpoint.",
    surface: "athlete",
    props: {
      targetField: "string — see comment_sent",
      count: "number — comments marked in this batch",
    },
  },

  /** User soft-deleted a comment (self-undo or moderator). */
  comment_deleted: {
    description: "Comment soft-deleted via author undo or coach moderation.",
    surface: "athlete",
    props: {
      targetField: "string — see comment_sent",
      moderator: "boolean — true when a coach deleted someone else's comment",
    },
  },

  /** User changed a notification preference (channel, type override, or quiet hours). */
  preferences_updated: {
    description: "Notification preferences updated (channel, type override, quiet hours).",
    surface: "athlete",
    props: {
      field: "string — the preference key that changed",
    },
  },
} as const satisfies Record<string, EventDescriptor>;

type EventDescriptor = {
  description: string;
  surface: "public" | "coach" | "athlete";
  props: Record<string, string>;
};

export type EventName = keyof typeof EVENT_SCHEMAS;

/* ─── Payload types ────────────────────────────────────────────────────
   These are the runtime shapes. Kept separate from EVENT_SCHEMAS (which
   documents payloads as human-readable strings for the reference page)
   because doc strings don't make good type constraints. */

export type EventPayloads = {
  scroll_depth: { percent: 25 | 50 | 75 | 100; path: string };
  throw_logged: {
    event: "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN";
    implementKg: number;
    distanceM: number;
    source: "quick_log" | "session_wizard" | "live_block";
  };
  session_saved: {
    sessionType: "throws" | "lift" | "mixed";
    isEdit: boolean;
    throwCount: number;
  };
  pr_celebrated: {
    event: "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN";
    distanceM: number;
    isCompetition: boolean;
  };
  roster_filtered: {
    facet: "event" | "group" | "status" | "search";
    hasValue: boolean;
  };
  exercise_searched: { queryLength: number; resultCount: number };
  plan_published: {
    planType: "session" | "program" | "bondarchuk";
    weekCount: number;
  };
  invite_sent: { method: "link_copy" | "email" };
  comment_sent: {
    targetField:
      | "throwLogId"
      | "practiceAttemptId"
      | "trainingSessionId"
      | "throwsAssignmentId"
      | "athleteDrillLogId"
      | "videoAnalysisId";
    hasAudio: boolean;
    role: "COACH" | "ATHLETE";
  };
  comment_read: {
    targetField:
      | "throwLogId"
      | "practiceAttemptId"
      | "trainingSessionId"
      | "throwsAssignmentId"
      | "athleteDrillLogId"
      | "videoAnalysisId";
    count: number;
  };
  comment_deleted: {
    targetField:
      | "throwLogId"
      | "practiceAttemptId"
      | "trainingSessionId"
      | "throwsAssignmentId"
      | "athleteDrillLogId"
      | "videoAnalysisId";
    moderator: boolean;
  };
  preferences_updated: {
    field: string;
  };
};

/* ─── Emit ─────────────────────────────────────────────────────────────── */

/**
 * Emit a product event. Safe to call anywhere (client or server). Server
 * calls no-op silently — Vercel Analytics is client-only.
 */
export function track<N extends EventName>(name: N, payload: EventPayloads[N]): void {
  if (typeof window === "undefined") return;

  if (process.env.NODE_ENV !== "production") {
    // Fail-loud in dev so missing wires are visible in the console.
    logger.info(`[analytics] ${name}`, {
      context: "analytics",
      metadata: { name, payload: payload as Record<string, unknown> },
    });
  }

  try {
    vercelTrack(name, payload as Record<string, string | number | boolean | null>);
  } catch (err) {
    // Analytics must never break the app. Swallow — the dev console log — above is enough signal during development.
    logger.debug(
      "Analytics must never break the app. Swallow — the dev console log — above is enough signal during development.",
      {
        context: "src/lib/analytics.ts",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      }
    );
  }
}
