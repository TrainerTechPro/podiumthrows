/**
 * Centralized date/timezone utilities.
 *
 * All user-facing "today", "this week", and cross-day comparisons MUST go
 * through these helpers. The server runs in UTC (Vercel) but users are all
 * over the world. Every date-sensitive operation needs to know the user's
 * IANA timezone to produce the right answer.
 *
 * Default timezone when none is set: "America/New_York" (largest user segment).
 */

const DEFAULT_TIMEZONE = "America/New_York";

/** Resolve a timezone string, falling back to the default. */
export function resolveTimezone(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TIMEZONE;
  try {
    // Validate by attempting to format — invalid TZ throws
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/** Returns the current local date in the given timezone as "YYYY-MM-DD". */
export function getLocalDate(timezone: string | null | undefined, at: Date = new Date()): string {
  const tz = resolveTimezone(timezone);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

/** Returns the day of week in the given timezone (0 = Sunday, 6 = Saturday). */
export function getLocalDayOfWeek(timezone: string | null | undefined, at: Date = new Date()): number {
  const tz = resolveTimezone(timezone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).formatToParts(at);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday] ?? 0;
}

/** Returns the current hour (0-23) in the given timezone. */
export function getLocalHour(timezone: string | null | undefined, at: Date = new Date()): number {
  const tz = resolveTimezone(timezone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "0";
  return parseInt(hour, 10);
}

/**
 * Combine a local date string (YYYY-MM-DD) and local time string (HH:MM) in the
 * given timezone into an absolute UTC Date. Used for converting user-scheduled
 * practice times into absolute moments for cron comparisons.
 *
 * Example: combineLocalDateTime("2026-04-08", "15:00", "America/New_York")
 *          returns a Date for April 8 2026 at 3pm ET = 19:00 UTC (during EDT)
 */
export function combineLocalDateTime(
  date: string,
  time: string,
  timezone: string | null | undefined,
): Date {
  const tz = resolveTimezone(timezone);
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);

  // Compute the UTC offset for this date/tz combo by formatting against the tz
  // and comparing against UTC interpretation. Uses a binary-search-free trick:
  // construct the naive UTC date, then compute what THAT wall-clock looks like
  // in the target timezone, and apply the delta.
  const naiveUtc = new Date(Date.UTC(y, m - 1, d, h, min, 0));
  const partsInTz = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(naiveUtc);
  const get = (type: string) => {
    const p = partsInTz.find((pp) => pp.type === type)?.value ?? "0";
    return parseInt(p, 10);
  };
  const tzYear = get("year");
  const tzMonth = get("month") - 1;
  const tzDay = get("day");
  // hourCycle "h23" edge case: "24" can appear for midnight in some impls
  const tzHourRaw = get("hour");
  const tzHour = tzHourRaw === 24 ? 0 : tzHourRaw;
  const tzMinute = get("minute");

  // The delta between naive UTC and how it's rendered in tz tells us the offset
  const tzAsUtc = Date.UTC(tzYear, tzMonth, tzDay, tzHour, tzMinute, 0);
  const offsetMs = tzAsUtc - naiveUtc.getTime();

  // Apply the offset in reverse to get the actual UTC moment for the wall time
  return new Date(naiveUtc.getTime() - offsetMs);
}

/** Returns the start of yesterday in the given timezone as a UTC Date. */
export function startOfYesterday(timezone: string | null | undefined, at: Date = new Date()): Date {
  const todayLocal = getLocalDate(timezone, at);
  const [y, m, d] = todayLocal.split("-").map(Number);
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1, 0, 0, 0));
  return combineLocalDateTime(
    `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterday.getUTCDate()).padStart(2, "0")}`,
    "00:00",
    timezone,
  );
}

/** Returns the start of today in the given timezone as a UTC Date. */
export function startOfToday(timezone: string | null | undefined, at: Date = new Date()): Date {
  const todayLocal = getLocalDate(timezone, at);
  return combineLocalDateTime(todayLocal, "00:00", timezone);
}

// ─── Server-side user timezone lookups ──────────────────────────────────────
// These functions import prisma and are only safe to call from server code
// (Server Components, Route Handlers, Server Actions).

import prisma from "@/lib/prisma";

/**
 * Look up the current user's timezone by userId. Returns the stored value,
 * or the default if no timezone is set yet (e.g. pre-migration user who hasn't
 * logged in since the detection hook was added).
 */
export async function getUserTimezone(userId: string): Promise<string> {
  const [athlete, coach] = await Promise.all([
    prisma.athleteProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    }),
    prisma.coachProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    }),
  ]);
  return resolveTimezone(athlete?.timezone ?? coach?.timezone);
}

/** Same but takes an athleteId directly. */
export async function getAthleteTimezone(athleteId: string): Promise<string> {
  const athlete = await prisma.athleteProfile.findUnique({
    where: { id: athleteId },
    select: { timezone: true },
  });
  return resolveTimezone(athlete?.timezone);
}

/** Same but takes a coachId directly. */
export async function getCoachTimezone(coachId: string): Promise<string> {
  const coach = await prisma.coachProfile.findUnique({
    where: { id: coachId },
    select: { timezone: true },
  });
  return resolveTimezone(coach?.timezone);
}
