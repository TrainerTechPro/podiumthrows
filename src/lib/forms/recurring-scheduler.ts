/**
 * Recurring schedule calculation utilities.
 * Used by the cron endpoint and schedule editor.
 */

import type { RecurrenceFrequency } from "./types";

interface ScheduleParams {
  frequency: RecurrenceFrequency;
  specificDays?: number[]; // 0=Sun ... 6=Sat
  startDate: Date;
  endDate?: Date | null;
  lastRunAt?: Date | null;
}

/**
 * Calculate the next run date for a recurring schedule.
 * Returns null if the schedule has expired or can't calculate a next date.
 */
export function calculateNextRunDate(params: ScheduleParams): Date | null {
  const { frequency, specificDays, startDate, endDate, lastRunAt } = params;

  const now = new Date();
  const today = startOfDay(now);

  // Schedule hasn't started yet
  if (startDate > today) {
    if (frequency === "SPECIFIC_DAYS" && specificDays?.length) {
      // Find the first matching day on or after startDate
      return findNextSpecificDay(startDate, specificDays, endDate ?? undefined);
    }
    return startDate;
  }

  // Schedule has expired
  if (endDate && endDate < today) {
    return null;
  }

  const baseDate = lastRunAt ? startOfDay(lastRunAt) : startOfDay(startDate);

  let nextDate: Date | null = null;

  switch (frequency) {
    case "DAILY":
      nextDate = addDays(baseDate, 1);
      // If we're behind, jump to today
      if (nextDate < today) nextDate = today;
      break;

    case "SPECIFIC_DAYS":
      if (!specificDays?.length) return null;
      // Find next matching day after lastRunAt (or today if behind)
      nextDate = findNextSpecificDay(
        lastRunAt ? addDays(baseDate, 1) : today,
        specificDays,
        endDate ?? undefined
      );
      break;

    case "WEEKLY":
      nextDate = addDays(baseDate, 7);
      if (nextDate < today) {
        // Jump to next matching weekday from today
        const dayOfWeek = startDate.getDay();
        nextDate = findNextWeekday(today, dayOfWeek);
      }
      break;

    case "BIWEEKLY":
      nextDate = addDays(baseDate, 14);
      if (nextDate < today) {
        // Jump ahead by the right number of 2-week intervals
        const daysSinceStart = daysBetween(startDate, today);
        const intervals = Math.ceil(daysSinceStart / 14);
        nextDate = addDays(startDate, intervals * 14);
      }
      break;

    case "MONTHLY": {
      const dayOfMonth = startDate.getDate();
      nextDate = nextMonthOnDay(baseDate, dayOfMonth);
      if (nextDate < today) {
        nextDate = nextMonthOnDay(today, dayOfMonth);
        // If today's day already passed the target, the function handles it
      }
      break;
    }

    default:
      return null;
  }

  // Check end date
  if (nextDate && endDate && nextDate > endDate) {
    return null;
  }

  return nextDate;
}

/**
 * Check if a schedule should run today.
 */
export function shouldRunToday(params: ScheduleParams): boolean {
  const { frequency, specificDays, startDate, endDate, lastRunAt } = params;

  const today = startOfDay(new Date());

  // Not started yet or expired
  if (startDate > today) return false;
  if (endDate && endDate < today) return false;

  // Already ran today
  if (lastRunAt && startOfDay(lastRunAt).getTime() === today.getTime()) {
    return false;
  }

  switch (frequency) {
    case "DAILY":
      return true;

    case "SPECIFIC_DAYS":
      if (!specificDays?.length) return false;
      return specificDays.includes(today.getDay());

    case "WEEKLY": {
      const dayOfWeek = startDate.getDay();
      if (today.getDay() !== dayOfWeek) return false;
      return true;
    }

    case "BIWEEKLY": {
      const dayOfWeek = startDate.getDay();
      if (today.getDay() !== dayOfWeek) return false;
      const daysSinceStart = daysBetween(startDate, today);
      return daysSinceStart % 14 < 7; // Runs on even weeks
    }

    case "MONTHLY": {
      const dayOfMonth = startDate.getDate();
      return today.getDate() === dayOfMonth;
    }

    default:
      return false;
  }
}

/**
 * Generate all instance dates for a schedule within a date range.
 * Useful for displaying the schedule preview.
 */
export function generateInstanceDates(
  params: ScheduleParams,
  rangeStart: Date,
  rangeEnd: Date,
  maxCount: number = 50
): Date[] {
  const dates: Date[] = [];
  let current = new Date(Math.max(params.startDate.getTime(), rangeStart.getTime()));

  while (current <= rangeEnd && dates.length < maxCount) {
    const testParams = { ...params, lastRunAt: dates.length > 0 ? dates[dates.length - 1] : null };
    const next = calculateNextRunDate(testParams);
    if (!next || next > rangeEnd) break;

    if (next >= rangeStart) {
      dates.push(next);
    }
    current = addDays(next, 1);
  }

  return dates;
}

// ─── Date Helpers ────────────────────────────────────────────────────────────

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((startOfDay(b).getTime() - startOfDay(a).getTime()) / msPerDay);
}

function findNextSpecificDay(
  from: Date,
  days: number[],
  endDate?: Date
): Date | null {
  const sorted = [...days].sort((a, b) => a - b);
  let current = startOfDay(from);

  // Look up to 8 days ahead (covers full week + 1)
  for (let i = 0; i < 8; i++) {
    if (sorted.includes(current.getDay())) {
      if (endDate && current > endDate) return null;
      return current;
    }
    current = addDays(current, 1);
  }

  return null;
}

function findNextWeekday(from: Date, dayOfWeek: number): Date {
  let current = startOfDay(from);
  for (let i = 0; i < 7; i++) {
    if (current.getDay() === dayOfWeek) return current;
    current = addDays(current, 1);
  }
  return current; // Should never reach here
}

function nextMonthOnDay(from: Date, dayOfMonth: number): Date {
  let month = from.getMonth() + 1;
  let year = from.getFullYear();
  if (month > 11) {
    month = 0;
    year++;
  }
  // Clamp day to max days in month
  const maxDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(dayOfMonth, maxDay);
  return new Date(year, month, day);
}
