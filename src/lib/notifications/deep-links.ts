import type { NotificationItem } from "@/lib/notifications";

/**
 * Six-way filter for the notifications page. "unread" is read-state-based
 * (no type filter); the four type-backed categories partition the
 * notification type space.
 *
 * Filter strip order: all | unread | comments | sessions | PRs | system
 */
export type NotificationCategory = "all" | "unread" | "comments" | "sessions" | "prs" | "system";

type TypeBackedCategory = "comments" | "sessions" | "prs" | "system";

const ATHLETE_CATEGORY_MAP: Record<TypeBackedCategory, string[]> = {
  comments: ["COMMENT_ADDED"],
  prs: ["PR_ALERT", "COMPETITION_PR"],
  sessions: [
    "WORKOUT_ASSIGNED",
    "WORKOUT_COMPLETED",
    "WORKOUT_SKIPPED",
    "STREAK_BROKEN",
    "STREAK_EXTENDED",
    "COMPETITION_REMINDER",
    "COMPETITION_LOGGED",
    "PROGRAMMING_REQUESTED",
    "PROGRAM_CHECKPOINT",
    "COMPLEX_ROTATED",
  ],
  system: [
    "QUESTIONNAIRE_ASSIGNED",
    "QUESTIONNAIRE_COMPLETE",
    "VIDEO_SHARED",
    "INSIGHT_NEW",
    "INVITATION_EXPIRED",
    "LOW_READINESS",
    "ATHLETE_JOINED",
    "WEEKLY_RECAP",
  ],
};

const COACH_CATEGORY_MAP: Record<TypeBackedCategory, string[]> = {
  comments: ["COMMENT_ADDED"],
  prs: ["PR_ALERT", "COMPETITION_PR"],
  sessions: [
    "WORKOUT_ASSIGNED",
    "WORKOUT_COMPLETED",
    "WORKOUT_SKIPPED",
    "PROGRAM_CHECKPOINT",
    "COMPLEX_ROTATED",
    "COMPETITION_REMINDER",
    "COMPETITION_LOGGED",
    "PROGRAMMING_REQUESTED",
    "ATHLETE_JOINED",
    "STREAK_BROKEN",
  ],
  system: [
    "QUESTIONNAIRE_ASSIGNED",
    "QUESTIONNAIRE_COMPLETE",
    "VIDEO_SHARED",
    "INSIGHT_NEW",
    "INVITATION_EXPIRED",
    "LOW_READINESS",
    "WEEKLY_RECAP",
  ],
};

/** Type filter for a category, or `null` for "all"/"unread". "unread" sets
 *  `unreadOnly=true` at the API layer via `categoryIsUnread`. */
export function categoryToTypes(
  category: NotificationCategory,
  role: "COACH" | "ATHLETE"
): string[] | null {
  if (category === "all" || category === "unread") return null;
  const map = role === "COACH" ? COACH_CATEGORY_MAP : ATHLETE_CATEGORY_MAP;
  return map[category];
}

export function categoryIsUnread(category: NotificationCategory): boolean {
  return category === "unread";
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * Resolve the canonical href for a notification. Honors metadata-supplied
 * `url` first (set at creation time by the notify* functions), then falls
 * back to per-type defaults that are guaranteed to land somewhere useful.
 *
 * Every NotificationType in src/lib/notifications.ts must have a defined
 * branch here — the default returns role-scoped /notifications so a stray
 * type at least lands on a valid page.
 */
export function getNotificationHref(n: NotificationItem, role: "COACH" | "ATHLETE"): string {
  const meta = (n.metadata ?? {}) as Record<string, unknown>;

  // Honor explicit metadata URLs first. Some legacy notifications stored the
  // path under `link` instead of `url` — accept both.
  const explicit = asString(meta.url) || asString(meta.href) || asString(meta.link);
  if (explicit && explicit.startsWith("/")) return explicit;

  const athleteId = asString(meta.athleteId) || n.athleteProfileId || undefined;
  const coachAthleteHref = athleteId ? `/coach/athletes/${athleteId}` : "/coach/athletes";

  switch (n.type) {
    /* ── Athlete-targeted ───────────────────────────────────────── */
    case "COMMENT_ADDED":
      return resolveCommentHref(meta, athleteId, role);

    case "VIDEO_SHARED": {
      const videoId = asString(meta.videoId);
      if (role === "ATHLETE") return videoId ? `/athlete/videos/${videoId}` : "/athlete/videos";
      return videoId ? `/coach/video-analysis/${videoId}` : "/coach/video-analysis";
    }

    case "WORKOUT_ASSIGNED": {
      const sessionId = asString(meta.sessionId) || asString(meta.trainingSessionId);
      if (role === "ATHLETE") {
        return sessionId ? `/athlete/session/${sessionId}` : "/athlete/sessions";
      }
      return sessionId ? `/coach/session/${sessionId}` : coachAthleteHref;
    }

    case "QUESTIONNAIRE_ASSIGNED": {
      const qid = asString(meta.questionnaireId);
      return role === "ATHLETE"
        ? qid
          ? `/athlete/questionnaires/${qid}`
          : "/athlete/questionnaires"
        : qid
          ? `/coach/questionnaires/${qid}`
          : "/coach/questionnaires";
    }

    case "COMPETITION_REMINDER": {
      const cid = asString(meta.competitionId);
      return role === "ATHLETE"
        ? cid
          ? `/athlete/competitions/${cid}`
          : "/athlete/competitions"
        : cid
          ? `/coach/athletes/competitions`
          : "/coach/athletes/competitions";
    }

    case "COMPETITION_PR":
    case "COMPETITION_LOGGED": {
      const cid = asString(meta.competitionId);
      if (role === "ATHLETE") return cid ? `/athlete/competitions/${cid}` : "/athlete/competitions";
      return cid && athleteId
        ? `/coach/athletes/${athleteId}?tab=competitions&competition=${cid}`
        : coachAthleteHref;
    }

    case "STREAK_BROKEN":
      return role === "ATHLETE" ? "/athlete/quick-log" : coachAthleteHref;

    case "STREAK_EXTENDED":
      return role === "ATHLETE" ? "/athlete/dashboard#streak-strip" : coachAthleteHref;

    case "INSIGHT_NEW":
      return role === "ATHLETE"
        ? "/athlete/dashboard"
        : athleteId
          ? `/coach/athletes/${athleteId}/insights`
          : "/coach/athletes";

    /* ── Coach-targeted ─────────────────────────────────────────── */
    case "PR_ALERT":
      return role === "COACH" ? coachAthleteHref : "/athlete/dashboard#streak-strip";

    case "LOW_READINESS":
      return role === "COACH" ? `${coachAthleteHref}?tab=readiness` : "/athlete/dashboard";

    case "WORKOUT_COMPLETED":
    case "WORKOUT_SKIPPED": {
      const sessionId = asString(meta.sessionId) || asString(meta.trainingSessionId);
      if (role === "COACH" && athleteId && sessionId) {
        return `/coach/athletes/${athleteId}?tab=training&session=${sessionId}`;
      }
      if (role === "COACH") return coachAthleteHref;
      return sessionId ? `/athlete/session/${sessionId}` : "/athlete/sessions";
    }

    case "QUESTIONNAIRE_COMPLETE": {
      const qid = asString(meta.questionnaireId);
      const responseId = asString(meta.responseId);
      if (role === "COACH") {
        if (qid && responseId) return `/coach/questionnaires/${qid}/responses/${responseId}`;
        if (qid) return `/coach/questionnaires/${qid}`;
        return "/coach/questionnaires";
      }
      return qid ? `/athlete/questionnaires/${qid}` : "/athlete/questionnaires";
    }

    case "ATHLETE_JOINED":
      return coachAthleteHref;

    case "PROGRAM_CHECKPOINT":
    case "COMPLEX_ROTATED":
      return athleteId ? `/coach/athletes/${athleteId}?tab=programming` : coachAthleteHref;

    case "PROGRAMMING_REQUESTED":
      return athleteId ? `/coach/calendar?athlete=${athleteId}` : "/coach/calendar";

    case "INVITATION_EXPIRED":
      return "/coach/athletes/invitations";

    case "WEEKLY_RECAP": {
      const week = asString(meta.weekStart);
      return week ? `/athlete/dashboard?recap=${week}` : "/athlete/dashboard?recap=latest";
    }

    default:
      return role === "COACH" ? "/coach/notifications" : "/athlete/notifications";
  }
}

function resolveCommentHref(
  meta: Record<string, unknown>,
  athleteId: string | undefined,
  role: "COACH" | "ATHLETE"
): string {
  const targetField = asString(meta.targetField);
  const targetId = asString(meta.targetId);
  const feedbackId = asString(meta.feedbackId);

  if (role === "ATHLETE") {
    // Athlete viewing feedback from coach. Prefer the feedback-list anchor
    // when the originating record is a coach feedback row; fall back to the
    // session view for older comments tied to training sessions.
    if (feedbackId) return `/athlete/feedback#${feedbackId}`;
    switch (targetField) {
      case "trainingSessionId":
        return targetId ? `/athlete/session/${targetId}` : "/athlete/sessions";
      case "throwsAssignmentId":
        return targetId ? `/athlete/throws/${targetId}` : "/athlete/throws";
      case "throwLogId":
        return "/athlete/throws/history";
      default:
        return "/athlete/feedback";
    }
  }

  // COACH viewing comment thread
  switch (targetField) {
    case "throwsAssignmentId":
      return athleteId && targetId
        ? `/coach/throws/${targetId}?athlete=${athleteId}`
        : "/coach/athletes";
    case "practiceAttemptId": {
      const sessionId = asString(meta.practiceSessionId);
      return sessionId ? `/coach/throws/practice/${sessionId}` : "/coach/calendar?view=live";
    }
    case "trainingSessionId":
      return targetId ? `/coach/session/${targetId}` : "/coach/athletes";
    case "throwLogId":
      return athleteId ? `/coach/athletes/${athleteId}` : "/coach/athletes";
    default:
      return athleteId ? `/coach/athletes/${athleteId}` : "/coach/athletes";
  }
}
