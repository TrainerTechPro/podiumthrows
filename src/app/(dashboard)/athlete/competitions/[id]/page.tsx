import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { MeetDetailClient } from "@/components/competitions/MeetDetailClient";
import type { CoachComment } from "@/components/competitions/MeetCoachNotes";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const meet = await prisma.throwsCompetition.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: meet ? `${meet.name} — Podium Throws` : "Meet — Podium Throws" };
}

const ROUND_LABEL: Record<string, string> = { PRELIM: "Prelim", FINALS: "Finals" };

export default async function AthleteMeetDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return notFound();

  const meet = await prisma.throwsCompetition.findUnique({
    where: { id },
    include: {
      athlete: { select: { id: true, userId: true, firstName: true, lastName: true } },
      throws: true,
    },
  });
  if (!meet) return notFound();

  // Safety net: athlete can only see their own competitions
  if (meet.athlete.userId !== session.userId) return notFound();

  // Hand-sort: Postgres sorts the ThrowRound enum alphabetically (FINALS < PRELIM).
  const roundOrder: Record<string, number> = { PRELIM: 0, FINALS: 1 };
  meet.throws.sort((a, b) => {
    const ro = (roundOrder[a.round ?? ""] ?? 99) - (roundOrder[b.round ?? ""] ?? 99);
    if (ro !== 0) return ro;
    return (a.attemptInRound ?? 0) - (b.attemptInRound ?? 0);
  });

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
    notes: meet.notes ?? null,
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

  // Season-best (this calendar year, prior throws only) — drives the hero
  // delta chip. We deliberately pull from ThrowLog rather than ThrowsPR so
  // practice marks count too; coaches care about progression overall.
  const meetDate = new Date(`${meet.date}T00:00:00`);
  const yearStart = new Date(meetDate.getFullYear(), 0, 1);
  const seasonAggregate = await prisma.throwLog.aggregate({
    where: {
      athleteId: meet.athleteId,
      event: meet.event,
      isFoul: false,
      isPass: false,
      distance: { not: null },
      date: { gte: yearStart, lt: meetDate },
      // Exclude throws inside this very meet (race condition if the date is
      // the same day as practice rows somehow).
      competitionId: { not: meet.id },
    },
    _max: { distance: true },
  });
  const seasonBestDistance = seasonAggregate._max.distance ?? null;

  // All-time best for this event — used to decide whether the medal lights
  // up. Includes the meet's own throws so a fresh PB during this meet still
  // qualifies.
  const allTimeAggregate = await prisma.throwLog.aggregate({
    where: {
      athleteId: meet.athleteId,
      event: meet.event,
      isFoul: false,
      isPass: false,
      distance: { not: null },
    },
    _max: { distance: true },
  });
  const allTimeBestDistance = allTimeAggregate._max.distance ?? null;

  // Coach comments tied to any throw in this meet. ThrowComment is
  // polymorphic — we filter to throwLogId-targeted, COACH-authored, not
  // soft-deleted.
  const throwIds = meet.throws.map((t) => t.id);
  const rawComments = throwIds.length
    ? await prisma.throwComment.findMany({
        where: {
          throwLogId: { in: throwIds },
          authorRole: "COACH",
          deletedAt: null,
        },
        select: {
          id: true,
          body: true,
          audioUrl: true,
          audioDurationSec: true,
          throwLogId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  // Map throwLogId → "Prelim 2" so the UI can show which attempt the
  // comment belongs to without an extra round-trip.
  const attemptLabelById = new Map<string, string>();
  for (const t of meet.throws) {
    if (t.round && t.attemptInRound != null) {
      attemptLabelById.set(t.id, `${ROUND_LABEL[t.round] ?? t.round} ${t.attemptInRound}`);
    }
  }

  const coachComments: CoachComment[] = rawComments.map((c) => ({
    id: c.id,
    body: c.body,
    audioUrl: c.audioUrl,
    audioDurationSec: c.audioDurationSec,
    attemptLabel: c.throwLogId ? (attemptLabelById.get(c.throwLogId) ?? "Throw") : "Throw",
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <MeetDetailClient
      meet={serialized}
      backHref="/athlete/competitions"
      backLabel="All Competitions"
      seasonBestDistance={seasonBestDistance}
      allTimeBestDistance={allTimeBestDistance}
      athlete={{ firstName: meet.athlete.firstName, lastName: meet.athlete.lastName }}
      coachComments={coachComments}
    />
  );
}
