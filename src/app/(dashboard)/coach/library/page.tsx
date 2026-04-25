import { redirect } from "next/navigation";
import {
  requireCoachSession,
  getExerciseLibrary,
  getWorkoutPlans,
  getDrillLibrary,
} from "@/lib/data/coach";
import { prisma } from "@/lib/prisma";
import { LibraryTabsClient } from "./_library-tabs";

export const metadata = { title: "Library — Podium Throws" };

type SearchParams = {
  view?: string;
  event?: string;
  category?: string;
  difficulty?: string;
  athleteType?: string;
  search?: string;
};

export default async function CoachLibraryPage({ searchParams }: { searchParams: SearchParams }) {
  let result: Awaited<ReturnType<typeof requireCoachSession>>;
  try {
    result = await requireCoachSession();
  } catch {
    redirect("/login");
  }

  const drillFilters: {
    event?: string;
    category?: string;
    difficulty?: string;
    athleteType?: string;
    search?: string;
  } = {};
  if (searchParams.event) drillFilters.event = searchParams.event;
  if (searchParams.category) drillFilters.category = searchParams.category;
  if (searchParams.difficulty) drillFilters.difficulty = searchParams.difficulty;
  if (searchParams.athleteType) drillFilters.athleteType = searchParams.athleteType;
  if (searchParams.search) drillFilters.search = searchParams.search;

  const drillVideoWhere: Record<string, unknown> = {
    videoUrl: { not: null },
    OR: [{ coachId: result.coach.id }, { isGlobal: true }],
  };
  if (searchParams.event) drillVideoWhere.event = searchParams.event;
  if (searchParams.category) drillVideoWhere.category = searchParams.category;
  if (searchParams.difficulty) drillVideoWhere.difficulty = searchParams.difficulty;

  const [plans, exercises, drills, drillVideos] = await Promise.all([
    getWorkoutPlans(result.coach.id),
    getExerciseLibrary(result.coach.id),
    getDrillLibrary(result.coach.id, drillFilters),
    prisma.drill.findMany({
      where: drillVideoWhere,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        videoUrl: true,
        event: true,
        category: true,
        difficulty: true,
        isGlobal: true,
        coachId: true,
      },
    }),
  ]);

  const ownDrillCount = drills.filter((d) => d.isOwn).length;
  const globalDrillCount = drills.filter((d) => d.isGlobal).length;

  return (
    <LibraryTabsClient
      plans={plans}
      exercises={exercises}
      drills={drills}
      drillVideos={drillVideos}
      ownDrillCount={ownDrillCount}
      globalDrillCount={globalDrillCount}
    />
  );
}
