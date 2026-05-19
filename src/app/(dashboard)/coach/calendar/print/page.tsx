import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getProgrammedSessions } from "@/lib/data/programming";
import { formatEventType } from "@/lib/utils";
import {
  PrintShell,
  PrintHeader,
  PrintFooter,
  formatPrintDate,
} from "@/components/print/PrintShell";

export const metadata = { title: "Print Weekly Program — Podium Throws" };

/* ─── Types for block config ────────────────────────────────────────────── */

interface ThrowingConfig {
  event?: string;
  implementWeight?: string;
  implementWeightKg?: number;
  throwCount?: number;
  intensityMin?: number;
  intensityMax?: number;
  techniqueFocus?: string;
  notes?: string;
}

interface StrengthExercise {
  name: string;
  sets: number;
  reps: number;
  percentage?: number;
  classification?: string;
}

interface StrengthConfig {
  exercises?: StrengthExercise[];
}

interface BlockRow {
  id: string;
  blockType: string;
  position: number;
  config: string;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function parseConfig<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function formatWeekRange(start: string): string {
  const end = addDaysStr(start, 6);
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  const sMonth = s.toLocaleDateString("en-US", { month: "short" });
  const eMonth = e.toLocaleDateString("en-US", { month: "short" });
  if (sMonth === eMonth) {
    return `${sMonth} ${s.getDate()} \u2013 ${e.getDate()}, ${s.getFullYear()}`;
  }
  return `${sMonth} ${s.getDate()} \u2013 ${eMonth} ${e.getDate()}, ${s.getFullYear()}`;
}

function getMonday(d: Date): Date {
  const result = new Date(d);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default async function PrintProgramPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; athlete?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  if (!session || session.role !== "COACH") redirect("/login");

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true, firstName: true, lastName: true, organization: true },
  });
  if (!coach) redirect("/login");

  // Default to current week's Monday
  const startDate = params.start ?? toDateStr(getMonday(new Date()));
  const endDate = addDaysStr(startDate, 6);

  // Fetch programmed sessions for the week
  let sessions = await getProgrammedSessions(coach.id, startDate, endDate);

  // Optional per-athlete filter
  const athleteFilter = params.athlete;
  if (athleteFilter) {
    sessions = sessions.filter(
      (s) =>
        s.athlete?.id === athleteFilter || s.tier === "TEAM" || (s.tier === "GROUP" && !s.athlete)
    );
  }

  // Fetch full block details for all referenced ThrowsSessions
  const throwsSessionIds = [...new Set(sessions.map((s) => s.throwsSession.id))];
  const throwsSessions = await prisma.throwsSession.findMany({
    where: { id: { in: throwsSessionIds } },
    select: {
      id: true,
      blocks: {
        select: { id: true, blockType: true, position: true, config: true },
        orderBy: { position: "asc" },
      },
    },
  });
  const blocksMap = new Map(throwsSessions.map((ts) => [ts.id, ts.blocks]));

  // Group sessions by day (skip empty days)
  const days: { date: string; label: string; sessions: typeof sessions }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDaysStr(startDate, i);
    const daySessions = sessions.filter((s) => s.scheduledDate === date);
    if (daySessions.length > 0) {
      days.push({ date, label: formatDayHeader(date), sessions: daySessions });
    }
  }

  const backHref = "/coach/schedule";

  const focusedAthlete =
    athleteFilter && sessions[0]?.athlete
      ? `${sessions[0].athlete.firstName} ${sessions[0].athlete.lastName}`
      : null;

  return (
    <PrintShell orientation="portrait" backHref={backHref} backLabel="Back to programming">
      <PrintHeader
        title="Weekly Program"
        byline={
          <>
            <span className="font-semibold">
              {coach.firstName} {coach.lastName}
            </span>
            {coach.organization && (
              <span className="text-muted print:text-surface-600">
                {" "}
                &mdash; {coach.organization}
              </span>
            )}
            {focusedAthlete && (
              <>
                {" "}
                &middot; Athlete: <span className="font-semibold">{focusedAthlete}</span>
              </>
            )}
          </>
        }
        rightSlot={<>{formatWeekRange(startDate)}</>}
        subtitle={`Printed ${formatPrintDate()}`}
      />

      {/* Days */}
      {days.length === 0 ? (
        <p className="text-sm text-muted py-8 text-center">
          No sessions programmed this week — schedule one in the calendar before printing.
        </p>
      ) : (
        <div className="space-y-5 print:space-y-4">
          {days.map((day) => (
            <div key={day.date}>
              {/* Day header */}
              <h2 className="text-sm font-heading font-bold uppercase tracking-wider mb-2 pb-1 border-b border-surface-400 print:text-black print:border-surface-400">
                {day.label}
              </h2>

              <div className="space-y-3 print:space-y-2">
                {day.sessions.map((s) => {
                  const blocks = blocksMap.get(s.throwsSession.id) ?? [];
                  return (
                    <SessionBlock
                      key={s.id}
                      title={s.title}
                      sessionName={s.throwsSession.name}
                      event={s.throwsSession.event}
                      tier={s.tier}
                      groupName={s.group?.name ?? null}
                      athleteName={
                        s.athlete ? `${s.athlete.firstName} ${s.athlete.lastName}` : null
                      }
                      notes={s.notes}
                      blocks={blocks}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notes section — blank lines for handwriting */}
      <div className="mt-8 pt-4 border-t border-surface-300 print:border-surface-400">
        <h3 className="text-xs font-heading font-bold uppercase tracking-wider mb-2 print:text-black">
          Notes
        </h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border-b border-surface-200 print:border-surface-300 h-6" />
          ))}
        </div>
      </div>

      <PrintFooter />
    </PrintShell>
  );
}

/* ─── Session Block ─────────────────────────────────────────────────────── */

function SessionBlock({
  title,
  sessionName,
  event,
  tier,
  groupName,
  athleteName,
  notes,
  blocks,
}: {
  title: string;
  sessionName: string;
  event: string;
  tier: string;
  groupName: string | null;
  athleteName: string | null;
  notes: string | null;
  blocks: BlockRow[];
}) {
  const throwingBlocks = blocks.filter((b) => b.blockType === "THROWING");
  const strengthBlocks = blocks.filter((b) => b.blockType === "STRENGTH");
  const otherBlocks = blocks.filter(
    (b) => b.blockType !== "THROWING" && b.blockType !== "STRENGTH"
  );

  const assignee = athleteName ?? groupName ?? (tier === "TEAM" ? "All Athletes" : null);

  return (
    <div className="print-block border border-surface-300 dark:border-surface-700 rounded-lg p-3 print:border-surface-400 print:rounded-none">
      {/* Session header */}
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <div>
          <span className="text-sm font-semibold print:text-black">{title}</span>
          {sessionName !== title && (
            <span className="text-xs text-muted print:text-surface-500 ml-2">({sessionName})</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted print:text-surface-500 shrink-0">
          <span>{formatEventType(event)}</span>
          {assignee && <span>&middot; {assignee}</span>}
        </div>
      </div>

      {/* Throwing blocks */}
      {throwingBlocks.length > 0 && (
        <div className="mb-2">
          <h4 className="text-nano font-bold uppercase tracking-wider text-muted print:text-surface-500 mb-1">
            Throwing
          </h4>
          <table className="w-full text-xs print:text-black">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-700 print:border-surface-300">
                <th className="text-left py-0.5 font-semibold">Implement</th>
                <th className="text-right py-0.5 font-semibold w-20">Throws</th>
                <th className="text-right py-0.5 font-semibold w-24">Intensity</th>
                <th className="text-left py-0.5 font-semibold pl-3">Focus</th>
              </tr>
            </thead>
            <tbody>
              {throwingBlocks.map((b) => {
                const cfg = parseConfig<ThrowingConfig>(b.config);
                return (
                  <tr
                    key={b.id}
                    className="border-b border-surface-100 dark:border-surface-800 print:border-surface-200"
                  >
                    <td className="py-1 font-mono">{cfg?.implementWeight || "\u2014"}</td>
                    <td className="py-1 text-right font-mono">{cfg?.throwCount ?? "\u2014"}</td>
                    <td className="py-1 text-right font-mono">
                      {cfg?.intensityMin && cfg?.intensityMax
                        ? `${cfg.intensityMin}\u2013${cfg.intensityMax}%`
                        : "\u2014"}
                    </td>
                    <td className="py-1 pl-3 text-muted print:text-surface-500 capitalize">
                      {cfg?.techniqueFocus?.replace(/_/g, " ").toLowerCase() ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Strength blocks */}
      {strengthBlocks.length > 0 && (
        <div className="mb-2">
          <h4 className="text-nano font-bold uppercase tracking-wider text-muted print:text-surface-500 mb-1">
            Strength
          </h4>
          <table className="w-full text-xs print:text-black">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-700 print:border-surface-300">
                <th className="text-left py-0.5 font-semibold">Exercise</th>
                <th className="text-right py-0.5 font-semibold w-24">Sets x Reps</th>
                <th className="text-right py-0.5 font-semibold w-16">Load</th>
              </tr>
            </thead>
            <tbody>
              {strengthBlocks.flatMap((b) => {
                const cfg = parseConfig<StrengthConfig>(b.config);
                if (!cfg?.exercises?.length) return [];
                return cfg.exercises.map((ex, i) => (
                  <tr
                    key={`${b.id}-${i}`}
                    className="border-b border-surface-100 dark:border-surface-800 print:border-surface-200"
                  >
                    <td className="py-1">{ex.name || "\u2014"}</td>
                    <td className="py-1 text-right font-mono">
                      {ex.sets} x {ex.reps}
                    </td>
                    <td className="py-1 text-right font-mono">
                      {ex.percentage ? `${ex.percentage}%` : "\u2014"}
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Other blocks (warmup, cooldown, plyometric, notes) */}
      {otherBlocks.length > 0 && (
        <div className="text-xs text-muted print:text-surface-500">
          {otherBlocks.map((b) => {
            const cfg = parseConfig<Record<string, unknown>>(b.config);
            const note = cfg?.notes ?? cfg?.description;
            return (
              <p key={b.id} className="py-0.5">
                <span className="font-semibold capitalize">{b.blockType.toLowerCase()}</span>
                {note ? `: ${String(note)}` : ""}
              </p>
            );
          })}
        </div>
      )}

      {/* Session notes */}
      {notes && <p className="text-xs text-muted print:text-surface-500 mt-1 italic">{notes}</p>}
    </div>
  );
}
