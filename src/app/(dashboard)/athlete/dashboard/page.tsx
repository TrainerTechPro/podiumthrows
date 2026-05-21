import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { loadAthleteDashboard } from "@/lib/athlete/dashboard-data";
import { AthleteHomeClient } from "./_athlete-home-client";

export const dynamic = "force-dynamic";

export default async function AthleteDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true, firstName: true, masterProfileCompletedAt: true },
  });
  if (!athlete) redirect("/login");

  const dto = await loadAthleteDashboard(athlete.id, athlete.firstName);

  const now = new Date();

  return (
    <AthleteHomeClient
      initial={dto}
      hour={now.getHours()}
      nowMs={now.getTime()}
      athleteId={athlete.id}
      masterProfileComplete={athlete.masterProfileCompletedAt != null}
    />
  );
}
