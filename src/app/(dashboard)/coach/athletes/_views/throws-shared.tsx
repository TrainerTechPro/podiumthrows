import { type EventCode } from "@/lib/throws/constants";

export const EVENT_LABELS: Record<EventCode, string> = {
  SP: "Shot Put",
  DT: "Discus",
  HT: "Hammer",
  JT: "Javelin",
};

export const EVENT_COLORS: Record<EventCode, string> = {
  SP: "#D4915A",
  DT: "#6A9FD8",
  HT: "#5BB88A",
  JT: "#D46A6A",
};

export interface CoachAthlete {
  id: string;
  profilePictureUrl?: string | null;
  user: { firstName: string; lastName: string; email: string; claimedAt?: string | null };
}

export interface RosterAthlete {
  id: string;
  firstName: string;
  lastName: string;
  events: string[];
  gender: string;
  avatarUrl?: string | null;
  user: { email: string; claimedAt: string | null };
  throwsPRs?: { event: string; implement: string; distance: number }[];
}

export interface ThrowsProfileRow {
  id: string;
  athleteId: string;
  event: string;
  gender: string;
  status: string;
  competitionPb: number | null;
  currentDistanceBand: string | null;
  deficitPrimary: string | null;
  deficitSecondary: string | null;
  deficitStatus: string | null;
  overPowered: boolean;
  enrolledAt: string;
  athlete: CoachAthlete;
  testingRecords: { testDate: string; testType: string }[];
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

export function TestingBadge({ records }: { records: { testDate: string }[] }) {
  if (records.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-nano font-semibold bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400 flex-shrink-0">
        <svg
          className="w-2.5 h-2.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Never tested
      </span>
    );
  }
  const days = daysSince(records[0].testDate);
  if (days > 14) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-nano font-semibold bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400 flex-shrink-0">
        <svg
          className="w-2.5 h-2.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Test due · {days}d ago
      </span>
    );
  }
  if (days > 7) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-nano font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex-shrink-0">
        <svg
          className="w-2.5 h-2.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        {days}d ago
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-nano font-semibold bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400 flex-shrink-0">
      <svg
        className="w-2.5 h-2.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      {days === 0 ? "Tested today" : `${days}d ago`}
    </span>
  );
}
