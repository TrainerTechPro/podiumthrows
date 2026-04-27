import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getWorkoutPlanDetail } from "@/lib/data/coach";
import { formatEventType } from "@/lib/utils";
import {
  PrintShell,
  PrintHeader,
  PrintFooter,
  formatPrintDate,
} from "@/components/print/PrintShell";

export const metadata = { title: "Print Plan — Podium Throws" };

const PHASE_LABEL: Record<string, string> = {
  GPP: "GPP — General Physical Preparation",
  SPP: "SPP — Special Physical Preparation",
  COMPETITION: "Competition",
  TRANSITION: "Transition",
};

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  SKIPPED: "Skipped",
  CANCELLED: "Cancelled",
};

function getMondayKey(iso: string): string {
  const d = new Date(iso);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatWeekRange(mondayKey: string): string {
  const [y, m, d] = mondayKey.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const sMonth = start.toLocaleDateString("en-US", { month: "long" });
  const eMonth = end.toLocaleDateString("en-US", { month: "long" });
  if (sMonth === eMonth) {
    return `${sMonth} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
  }
  return `${sMonth} ${start.getDate()} – ${eMonth} ${end.getDate()}, ${start.getFullYear()}`;
}

function formatDayHeader(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

interface DayGroup {
  iso: string;
  label: string;
  athletes: { name: string; status: string }[];
}

interface WeekGroup {
  mondayKey: string;
  range: string;
  days: DayGroup[];
}

export default async function PrintPlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;

  const session = await getSession();
  if (!session || session.role !== "COACH") redirect("/login");

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true, firstName: true, lastName: true, organization: true },
  });
  if (!coach) redirect("/login");

  const plan = await getWorkoutPlanDetail(planId, coach.id);
  if (!plan) notFound();

  // Group assignments by Monday-week, then by day. getWorkoutPlanDetail
  // already orders sessions desc — we want chronological for the wall plan,
  // so re-sort ascending here.
  const sortedAssignments = [...plan.assignments].sort((a, b) =>
    a.scheduledDate.localeCompare(b.scheduledDate)
  );

  const weekMap = new Map<string, Map<string, DayGroup>>();
  for (const a of sortedAssignments) {
    const dayIso = a.scheduledDate.slice(0, 10);
    const weekKey = getMondayKey(a.scheduledDate);
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, new Map());
    const dayMap = weekMap.get(weekKey)!;
    if (!dayMap.has(dayIso)) {
      dayMap.set(dayIso, {
        iso: dayIso,
        label: formatDayHeader(a.scheduledDate),
        athletes: [],
      });
    }
    dayMap.get(dayIso)!.athletes.push({
      name: `${a.athleteFirstName} ${a.athleteLastName}`,
      status: a.status,
    });
  }

  const weeks: WeekGroup[] = [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mondayKey, dayMap]) => ({
      mondayKey,
      range: formatWeekRange(mondayKey),
      days: [...dayMap.values()].sort((a, b) => a.iso.localeCompare(b.iso)),
    }));

  return (
    <PrintShell orientation="portrait" backHref={`/coach/plans/${planId}`} backLabel="Back to plan">
      <PrintHeader
        title={plan.name}
        byline={
          <>
            <span className="font-semibold">
              {coach.firstName} {coach.lastName}
            </span>
            {coach.organization && (
              <span className="text-muted print:text-gray-600"> &mdash; {coach.organization}</span>
            )}
          </>
        }
        rightSlot={<>{formatPrintDate()}</>}
        subtitle={[
          plan.event ? formatEventType(plan.event) : "General",
          plan.phase ? (PHASE_LABEL[plan.phase] ?? plan.phase) : null,
          `${plan.blocks.length} ${plan.blocks.length === 1 ? "block" : "blocks"}`,
          `${plan.assignedSessionCount} ${plan.assignedSessionCount === 1 ? "assignment" : "assignments"}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      {plan.description && (
        <p className="text-sm print:text-black mb-4 leading-relaxed">{plan.description}</p>
      )}

      {/* Page 1 — plan template structure */}
      <section className="print-keep-together">
        <h2 className="text-sm font-heading font-bold uppercase tracking-wider mb-2 pb-1 border-b border-gray-400 print:text-black print:border-gray-400">
          Plan Structure
        </h2>
        {plan.blocks.length === 0 ? (
          <p className="text-xs text-muted py-2">This plan has no blocks defined.</p>
        ) : (
          <div className="space-y-3">
            {plan.blocks.map((b) => (
              <div
                key={b.id}
                className="print-block border border-gray-300 print:border-gray-500 p-3 rounded-lg print:rounded-none"
              >
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <div className="text-sm font-semibold print:text-black">
                    <span className="font-mono text-muted print:text-gray-600 mr-2">
                      #{b.order + 1}
                    </span>
                    {b.name}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted print:text-gray-600">
                    {b.blockType}
                    {b.restSeconds && b.restSeconds > 0 ? ` · Rest ${b.restSeconds}s` : ""}
                  </span>
                </div>
                {b.notes && (
                  <p className="text-xs italic text-muted print:text-gray-600 mb-1.5">{b.notes}</p>
                )}
                {b.exercises.length === 0 ? (
                  <p className="text-xs text-muted print:text-gray-600">No exercises configured.</p>
                ) : (
                  <table className="w-full text-xs print:text-black">
                    <thead>
                      <tr className="border-b border-gray-200 print:border-gray-400">
                        <th className="text-left py-0.5 font-semibold">Exercise</th>
                        <th className="text-left py-0.5 font-semibold w-32">Category</th>
                        <th className="text-right py-0.5 font-semibold w-20">Sets x Reps</th>
                        <th className="text-right py-0.5 font-semibold w-20">Load</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.exercises.map((ex) => (
                        <tr key={ex.id} className="border-b border-gray-100 print:border-gray-300">
                          <td className="py-1">{ex.exerciseName}</td>
                          <td className="py-1 text-muted print:text-gray-600 capitalize">
                            {ex.exerciseCategory.toLowerCase().replace(/_/g, " ")}
                          </td>
                          <td className="py-1 text-right font-mono tabular-nums">
                            {ex.sets !== null && ex.reps !== null ? `${ex.sets} x ${ex.reps}` : "—"}
                          </td>
                          <td className="py-1 text-right font-mono tabular-nums">
                            {ex.weight ?? (ex.implementKg !== null ? `${ex.implementKg}kg` : "—")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* One page per week of the schedule */}
      {weeks.length === 0 ? (
        <section className="mt-6 pt-4 border-t border-gray-300 print:border-gray-400">
          <h2 className="text-sm font-heading font-bold uppercase tracking-wider mb-2 print:text-black">
            Schedule
          </h2>
          <p className="text-xs text-muted print:text-gray-600">
            This plan has not been assigned to any sessions yet.
          </p>
        </section>
      ) : (
        weeks.map((w) => (
          <section
            key={w.mondayKey}
            className="print-page-break print-keep-together pt-6 mt-6 border-t border-gray-300 print:border-gray-400"
          >
            <div className="flex items-baseline justify-between gap-4 mb-3">
              <h2 className="text-base font-heading font-bold uppercase tracking-wider print:text-black">
                Week of {w.range}
              </h2>
              <span className="text-xs text-muted print:text-gray-600 font-mono tabular-nums">
                {w.days.reduce((acc, d) => acc + d.athletes.length, 0)} session
                {w.days.reduce((acc, d) => acc + d.athletes.length, 0) === 1 ? "" : "s"}
              </span>
            </div>

            <div className="space-y-3">
              {w.days.map((day) => (
                <div
                  key={day.iso}
                  className="print-row border border-gray-300 print:border-gray-500 rounded-lg print:rounded-none p-3"
                >
                  <div className="flex items-baseline justify-between gap-2 mb-1.5 pb-1 border-b border-gray-200 print:border-gray-400">
                    <h3 className="text-sm font-semibold print:text-black">{day.label}</h3>
                    <span className="text-xs text-muted print:text-gray-600">{plan.name}</span>
                  </div>
                  <ul className="text-xs print:text-black space-y-0.5">
                    {day.athletes.map((a, i) => (
                      <li key={i} className="flex items-baseline justify-between gap-3">
                        <span>{a.name}</span>
                        <span className="text-muted print:text-gray-600 text-[10px] uppercase tracking-wider">
                          {STATUS_LABEL[a.status] ?? a.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      <PrintFooter />
    </PrintShell>
  );
}
