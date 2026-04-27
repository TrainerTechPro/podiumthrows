import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { loadCoachSessionDetail } from "@/lib/coach/load-session-detail";
import { CoachSessionDetailView } from "./_coach-session-view";

export const dynamic = "force-dynamic";

export default async function CoachSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id: athleteId, sessionId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "COACH") redirect("/login");

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!coach) redirect("/login");

  const dto = await loadCoachSessionDetail({
    sessionId,
    athleteProfileId: athleteId,
    coachProfileId: coach.id,
  });
  if (!dto) notFound();

  return <CoachSessionDetailView initial={dto} />;
}
