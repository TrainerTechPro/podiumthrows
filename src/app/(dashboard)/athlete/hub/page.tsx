import { redirect } from "next/navigation";
import { requireAthleteSession } from "@/lib/data/athlete";
import { getAthleteAnnouncements, getTeamLinks, getTeamFiles } from "@/lib/data/team-hub";
import prisma from "@/lib/prisma";
import { TeamHubClient } from "@/app/(dashboard)/coach/hub/_team-hub-client";
import { getAthleteTimezone, getLocalDate } from "@/lib/dates";

export const metadata = { title: "Team Hub — Podium Throws" };
export const dynamic = "force-dynamic";

export default async function AthleteHubPage() {
  let result;
  try {
    result = await requireAthleteSession();
  } catch (err) {
    // next/navigation redirect() throws a special error (NEXT_REDIRECT).
    // We must re-throw those so the redirect actually happens — swallowing
    // them would render the page with no data.
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("NEXT_REDIRECT")) throw err;
    // Only redirect to /login on true auth failures. For Prisma errors or
    // other unexpected exceptions, log and re-throw so the error boundary
    // can render a proper error page instead of silently logging the
    // athlete out.
    console.error("requireAthleteSession failed in hub", err);
    if (
      message.toLowerCase().includes("unauthorized") ||
      message.toLowerCase().includes("no session")
    ) {
      redirect("/login");
    }
    throw err;
  }

  const tz = await getAthleteTimezone(result.athlete.id);
  const today = getLocalDate(tz);
  const inThirtyDays = getLocalDate(tz, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

  // Get athlete's event group memberships for practice filtering
  const memberships = await prisma.eventGroupMember.findMany({
    where: { athleteId: result.athlete.id },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);

  const [announcements, links, files, upcomingPractices, upcomingCompetitions] = await Promise.all([
    getAthleteAnnouncements(result.athlete.id),
    getTeamLinks(result.athlete.coachId),
    getTeamFiles(result.athlete.coachId),
    prisma.scheduledPractice.findMany({
      where: {
        coachId: result.athlete.coachId,
        date: { gte: today, lte: inThirtyDays },
        status: "SCHEDULED",
        OR: [
          { groupId: null }, // all-team practices
          ...(groupIds.length > 0 ? [{ groupId: { in: groupIds } }] : []),
        ],
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 5,
    }),
    prisma.throwsCompetition.findMany({
      where: {
        athleteId: result.athlete.id,
        date: { gte: today },
      },
      orderBy: { date: "asc" },
      take: 5,
    }),
  ]);

  const upcoming = [
    ...upcomingPractices.map((p) => ({
      type: "practice" as const,
      id: p.id,
      title: p.title,
      date: p.date,
      time: p.startTime,
      meta: p.location ?? "",
    })),
    ...upcomingCompetitions.map((c) => ({
      type: "competition" as const,
      id: c.id,
      title: c.name,
      date: c.date,
      time: null,
      meta: c.event.replace(/_/g, " "),
    })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  return (
    <TeamHubClient
      mode="athlete"
      data={{
        announcements,
        links,
        files,
        upcoming,
        eventGroups: [],
        athletes: [],
      }}
    />
  );
}
