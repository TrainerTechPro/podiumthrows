import { notFound } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CompetitionListCard } from "@/components/competitions/CompetitionListCard";
import { StaggeredList } from "@/components/ui/StaggeredList";
import { EmptyState } from "@/components/ui/EmptyState";
import { AthleteAddMeetButton } from "./_add-meet-button";
import { ThrowsChipNav } from "../throws/_chip-nav";

export const metadata = { title: "Competitions — Podium Throws" };

export default async function AthleteCompetitionsPage() {
  const session = await getSession();
  if (!session) return notFound();

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true, events: true },
  });
  if (!athlete) return notFound();
  const athleteEvents = (athlete.events as string[] | null) ?? [];

  const competitions = await prisma.throwsCompetition.findMany({
    where: { athleteId: athlete.id },
    orderBy: { date: "desc" },
    include: {
      _count: { select: { throws: true } },
      throws: { select: { distance: true, isFoul: true, isPass: true } },
    },
  });

  const items = competitions.map((c) => {
    const valid = c.throws
      .filter((t) => !t.isFoul && !t.isPass && t.distance != null)
      .map((t) => t.distance as number);
    const bestMark = valid.length > 0 ? Math.max(...valid) : (c.result ?? null);
    return {
      id: c.id,
      name: c.name,
      date: c.date,
      event: c.event as string,
      placeFinish: c.placeFinish ?? null,
      meetStatus: (c.meetStatus ?? null) as "COMPLETED" | "DNS" | "DNF" | "DQ" | null,
      venueType: (c.venueType ?? null) as "INDOOR" | "OUTDOOR" | null,
      bestMark,
      throwCount: c._count.throws,
    };
  });

  return (
    <div className="mx-auto max-w-4xl p-4 space-y-4">
      <ThrowsChipNav />
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-2xl">Competitions</h1>
        <AthleteAddMeetButton athleteId={athlete.id} athleteEvents={athleteEvents} />
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck size={48} strokeWidth={1.75} aria-hidden="true" />}
          title="No competitions logged yet"
          description="Log a meet you've already thrown at — even retroactive entries count toward your trends."
          action={
            <AthleteAddMeetButton
              athleteId={athlete.id}
              athleteEvents={athleteEvents}
              variant="empty"
            />
          }
        />
      ) : (
        <StaggeredList className="grid gap-3">
          {items.map((item) => (
            <CompetitionListCard
              key={item.id}
              item={item}
              href={`/athlete/competitions/${item.id}`}
            />
          ))}
        </StaggeredList>
      )}
    </div>
  );
}
