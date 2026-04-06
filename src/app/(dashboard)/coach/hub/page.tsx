import { redirect } from "next/navigation";
import { requireCoachSession } from "@/lib/data/coach";
import {
  getCoachAnnouncements,
  getTeamLinks,
  getTeamFiles,
} from "@/lib/data/team-hub";
import prisma from "@/lib/prisma";
import { TeamHubClient } from "./_team-hub-client";

export const metadata = { title: "Team Hub — Podium Throws" };
export const dynamic = "force-dynamic";

export default async function CoachHubPage() {
  let result;
  try {
    result = await requireCoachSession();
  } catch {
    redirect("/login");
  }

  const today = new Date().toISOString().split("T")[0];
  const inThirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [
    announcements,
    links,
    files,
    upcomingPractices,
    upcomingCompetitions,
    eventGroups,
    athletes,
  ] = await Promise.all([
    getCoachAnnouncements(result.coach.id),
    getTeamLinks(result.coach.id),
    getTeamFiles(result.coach.id),
    prisma.scheduledPractice.findMany({
      where: {
        coachId: result.coach.id,
        date: { gte: today, lte: inThirtyDays },
        status: "SCHEDULED",
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 5,
    }),
    prisma.throwsCompetition.findMany({
      where: {
        athlete: { coachId: result.coach.id },
        date: { gte: today },
      },
      include: {
        athlete: { select: { firstName: true, lastName: true } },
      },
      orderBy: { date: "asc" },
      take: 5,
    }),
    prisma.eventGroup.findMany({
      where: { coachId: result.coach.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.athleteProfile.findMany({
      where: { coachId: result.coach.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  // Combine practices and competitions into "Coming Up" timeline
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
      meta: `${c.athlete.firstName} ${c.athlete.lastName} · ${c.event.replace(/_/g, " ")}`,
    })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  return (
    <TeamHubClient
      mode="coach"
      data={{
        announcements,
        links,
        files,
        upcoming,
        eventGroups,
        athletes,
      }}
    />
  );
}
