import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ReviewProfileClient } from "./_review-client";

export default async function ReviewProfilePage() {
  const session = await getSession();
  if (!session || session.role !== "ATHLETE") redirect("/login");

  const profile = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    include: {
      coach: { select: { firstName: true, lastName: true } },
      coachNotes: {
        where: { isPrivate: false },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      videos: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          url: true,
          thumbnailUrl: true,
          event: true,
          notes: true,
          createdAt: true,
        },
      },
    },
  });

  if (!profile) notFound();

  // Recent throws logged by the coach (most recent 10).
  const recentThrows = await prisma.throwLog.findMany({
    where: { athleteId: profile.id },
    orderBy: { date: "desc" },
    take: 10,
    select: {
      id: true,
      event: true,
      implementWeight: true,
      distance: true,
      date: true,
      isPersonalBest: true,
    },
  });

  return (
    <div className="px-4 py-8 md:py-12">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="font-heading text-2xl md:text-3xl font-bold mb-2">
            Welcome to Podium Throws
          </h1>
          <p className="text-[var(--muted)] text-sm md:text-base">
            Your coach{" "}
            <span className="font-semibold text-[var(--foreground)]">
              {profile.coach.firstName} {profile.coach.lastName}
            </span>{" "}
            has set up your profile. Review the info below and let them know if
            anything needs updating.
          </p>
        </div>

        <ReviewProfileClient
          profile={{
            id: profile.id,
            firstName: profile.firstName,
            lastName: profile.lastName,
            gender: profile.gender as string,
            events: profile.events as unknown as string[],
            heightCm: profile.heightCm,
            weightKg: profile.weightKg,
            classStanding: profile.classStanding,
            dateOfBirth: profile.dateOfBirth?.toISOString() ?? null,
            strengthNumbers:
              (profile.strengthNumbers as Record<string, number | null> | null) ??
              null,
            competitionPRs:
              (profile.competitionPRs as Record<string, number | null> | null) ??
              null,
          }}
          recentThrows={recentThrows.map((t) => ({
            id: t.id,
            event: t.event as string,
            implementWeight: t.implementWeight,
            distance: t.distance,
            date: t.date.toISOString(),
            isPersonalBest: t.isPersonalBest,
          }))}
          notes={profile.coachNotes.map((n) => ({
            id: n.id,
            content: n.content,
            category: n.category as string,
            createdAt: n.createdAt.toISOString(),
          }))}
          videos={profile.videos.map((v) => ({
            id: v.id,
            url: v.url,
            thumbnailUrl: v.thumbnailUrl,
            event: v.event as string | null,
            notes: v.notes,
            createdAt: v.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
