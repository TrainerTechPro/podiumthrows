import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { MeetDetailClient } from "./_meet-detail-client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const meet = await prisma.throwsCompetition.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: meet ? `${meet.name} — Podium Throws` : "Meet — Podium Throws" };
}

export default async function CoachMeetDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return notFound();

  const meet = await prisma.throwsCompetition.findUnique({
    where: { id },
    include: {
      athlete: {
        select: { id: true, userId: true, user: { select: { email: true } } },
      },
      throws: true,
    },
  });
  if (!meet) return notFound();

  // Verify this coach has access to the meet's athlete (roster scope).
  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!coach) return notFound();
  const athlete = await prisma.athleteProfile.findUnique({
    where: { id: meet.athleteId },
    select: { coachId: true },
  });
  if (!athlete || athlete.coachId !== coach.id) return notFound();

  // Hand-sort: Postgres sorts the ThrowRound enum alphabetically (FINALS < PRELIM).
  const roundOrder: Record<string, number> = { PRELIM: 0, FINALS: 1 };
  meet.throws.sort((a, b) => {
    const ro = (roundOrder[a.round ?? ""] ?? 99) - (roundOrder[b.round ?? ""] ?? 99);
    if (ro !== 0) return ro;
    return (a.attemptInRound ?? 0) - (b.attemptInRound ?? 0);
  });

  // Serialize prisma enums → plain strings for the client component
  const serialized = {
    id: meet.id,
    athleteId: meet.athleteId,
    name: meet.name,
    date: meet.date,
    event: meet.event as string,
    priority: meet.priority,
    result: meet.result ?? null,
    placeFinish: meet.placeFinish ?? null,
    meetStatus: meet.meetStatus as "COMPLETED" | "DNS" | "DNF" | "DQ",
    venueType: (meet.venueType ?? null) as "INDOOR" | "OUTDOOR" | null,
    weather: meet.weather ?? null,
    windMps: meet.windMps ?? null,
    format: (meet.format ?? "THREE_PLUS_THREE") as "THREE_PLUS_THREE" | "FOUR_STRAIGHT",
    madeFinals: meet.madeFinals ?? null,
    throws: meet.throws
      .filter((t) => t.round != null && t.attemptInRound != null)
      .map((t) => ({
        id: t.id,
        round: t.round as "PRELIM" | "FINALS",
        attemptInRound: t.attemptInRound as number,
        distance: t.distance ?? null,
        isFoul: t.isFoul,
        isPass: t.isPass,
        foulType: (t.foulType ?? null) as "RING" | "SECTOR" | null,
        notes: t.notes ?? null,
        videoUrl: t.videoUrl ?? null,
        wireLength: t.wireLength ?? null,
      })),
  };

  return (
    <MeetDetailClient
      meet={serialized}
      backHref="/coach/competitions"
      backLabel="All Competitions"
    />
  );
}
