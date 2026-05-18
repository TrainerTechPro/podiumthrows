import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { formatEventType } from "@/lib/utils";
import {
  PrintShell,
  PrintHeader,
  PrintFooter,
  formatPrintDate,
} from "@/components/print/PrintShell";

export const metadata = { title: "Print Roster — Podium Throws" };

const CLASS_LABEL: Record<string, string> = {
  FR: "Freshman",
  SO: "Sophomore",
  JR: "Junior",
  SR: "Senior",
  GRAD: "Grad",
  PRO: "Pro",
};

function formatLastSession(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const today = new Date();
  const diffDays = Math.floor((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (diffDays === 0) return `${dateStr} (today)`;
  if (diffDays === 1) return `${dateStr} (1d ago)`;
  if (diffDays < 14) return `${dateStr} (${diffDays}d ago)`;
  return dateStr;
}

function formatGoal(
  g: { title: string; currentValue: number; targetValue: number; unit: string } | null
): string {
  if (!g) return "—";
  const cur = Number.isFinite(g.currentValue) ? g.currentValue : 0;
  const tgt = Number.isFinite(g.targetValue) ? g.targetValue : 0;
  const decimals = g.unit === "meters" || g.unit === "m" ? 2 : 1;
  return `${g.title} — ${cur.toFixed(decimals)}/${tgt.toFixed(decimals)} ${g.unit}`;
}

export default async function PrintRosterPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  if (!session || session.role !== "COACH") redirect("/login");

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true, firstName: true, lastName: true, organization: true },
  });
  if (!coach) redirect("/login");

  // Resolve optional team filter so the print scope mirrors the on-screen
  // roster filter when coaches click "Print" from a filtered view.
  const teamId = params.teamId ?? null;
  const team =
    teamId && teamId !== "unassigned"
      ? await prisma.team.findFirst({
          where: { id: teamId, coachId: coach.id },
          select: { id: true, name: true },
        })
      : null;

  // Single hand-rolled query — getAthleteRoster doesn't return email or
  // active goals, so we fetch them here in one round-trip.
  const where =
    teamId === "unassigned"
      ? { coachId: coach.id, teamMemberships: { none: {} } }
      : team
        ? { coachId: coach.id, teamMemberships: { some: { teamId: team.id } } }
        : { coachId: coach.id };

  const athletes = await prisma.athleteProfile.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      events: true,
      classStanding: true,
      user: { select: { email: true } },
      readinessCheckIns: {
        orderBy: { date: "desc" },
        take: 1,
        select: { overallScore: true, injuryStatus: true, date: true },
      },
      trainingSessions: {
        where: { status: "COMPLETED" },
        orderBy: { completedDate: "desc" },
        take: 1,
        select: { completedDate: true },
      },
      goals: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { title: true, currentValue: true, targetValue: true, unit: true },
      },
    },
  });

  const teamLabel = team ? team.name : teamId === "unassigned" ? "Unassigned athletes" : null;

  return (
    <PrintShell orientation="landscape" backHref="/coach/athletes" backLabel="Back to roster">
      <PrintHeader
        title="Roster"
        byline={
          <>
            <span className="font-semibold">
              {coach.firstName} {coach.lastName}
            </span>
            {coach.organization && (
              <span className="text-muted print:text-gray-600"> &mdash; {coach.organization}</span>
            )}
            {teamLabel && (
              <span className="text-muted print:text-gray-600"> &mdash; {teamLabel}</span>
            )}
          </>
        }
        rightSlot={<>{formatPrintDate()}</>}
        subtitle={`${athletes.length} ${athletes.length === 1 ? "athlete" : "athletes"}`}
      />

      {athletes.length === 0 ? (
        <p className="text-sm text-muted py-8 text-center">No athletes on this roster.</p>
      ) : (
        <table className="print-table w-full text-xs print:text-black border-collapse">
          <thead>
            <tr className="border-b-2 border-black print:border-black">
              <th className="text-left py-1.5 px-2 font-heading font-bold uppercase tracking-wider">
                Athlete
              </th>
              <th className="text-left py-1.5 px-2 font-heading font-bold uppercase tracking-wider">
                Events
              </th>
              <th className="text-left py-1.5 px-2 font-heading font-bold uppercase tracking-wider w-20">
                Class
              </th>
              <th className="text-left py-1.5 px-2 font-heading font-bold uppercase tracking-wider">
                Contact
              </th>
              <th className="text-left py-1.5 px-2 font-heading font-bold uppercase tracking-wider w-32">
                Last Session
              </th>
              <th className="text-left py-1.5 px-2 font-heading font-bold uppercase tracking-wider w-32">
                Readiness
              </th>
              <th className="text-left py-1.5 px-2 font-heading font-bold uppercase tracking-wider">
                Active Goal
              </th>
            </tr>
          </thead>
          <tbody>
            {athletes.map((a) => {
              const r = a.readinessCheckIns[0] ?? null;
              const lastSession = a.trainingSessions[0]?.completedDate?.toISOString() ?? null;
              const goal = a.goals[0] ?? null;
              const lowReadiness = r && r.overallScore < 5;
              const injured = r?.injuryStatus === "ACTIVE";
              const monitoring = r?.injuryStatus === "MONITORING";

              return (
                <tr key={a.id} className="border-b border-gray-300 print:border-gray-400 align-top">
                  <td className="py-1.5 px-2 font-semibold">
                    {a.lastName}, {a.firstName}
                  </td>
                  <td className="py-1.5 px-2">
                    {a.events.length === 0
                      ? "—"
                      : (a.events as string[]).map(formatEventType).join(", ")}
                  </td>
                  <td className="py-1.5 px-2 font-mono">
                    {a.classStanding ? (CLASS_LABEL[a.classStanding] ?? a.classStanding) : "—"}
                  </td>
                  <td className="py-1.5 px-2 font-mono text-micro">{a.user.email}</td>
                  <td className="py-1.5 px-2 font-mono tabular-nums">
                    {formatLastSession(lastSession)}
                  </td>
                  <td className="py-1.5 px-2 font-mono tabular-nums">
                    {!r ? (
                      <span className="italic">No check-in</span>
                    ) : (
                      <>
                        {/* Bold + arrow makes "low" legible without color. */}
                        <span className={lowReadiness ? "font-bold" : ""}>
                          {lowReadiness ? "▲ " : ""}
                          {r.overallScore}/10
                        </span>
                        {injured && <span className="ml-1 font-bold uppercase">[Injured]</span>}
                        {monitoring && !injured && (
                          <span className="ml-1 italic">(monitoring)</span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="py-1.5 px-2">{formatGoal(goal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <PrintFooter />
    </PrintShell>
  );
}
