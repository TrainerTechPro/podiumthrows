import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { loadAthleteSessionDetail } from "@/lib/athlete/load-session-detail";
import { SessionDetailView } from "./_session-detail-view";

export const dynamic = "force-dynamic";

export default async function AthleteSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ATHLETE" && session.role !== "COACH") redirect("/login");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!athlete) redirect("/login");

  const dto = await loadAthleteSessionDetail(id, athlete.id);
  if (!dto) notFound();

  return <SessionDetailView initial={dto} />;
}
