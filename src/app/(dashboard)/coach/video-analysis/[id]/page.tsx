import { redirect, notFound } from "next/navigation";
import { requireCoachSession } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { AnalysisWorkspace } from "./_analysis-workspace";

export const metadata = { title: "Pose Analysis — Podium Throws" };

export default async function VideoAnalysisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let coach;
  try {
    const session = await requireCoachSession();
    coach = session.coach;
  } catch {
    redirect("/login");
  }

  const analysis = await prisma.videoAnalysis.findUnique({
    where: { id },
    include: {
      athlete: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true, events: true },
      },
    },
  });

  if (!analysis || analysis.coachId !== coach.id) {
    notFound();
  }

  return <AnalysisWorkspace analysis={JSON.parse(JSON.stringify(analysis))} />;
}
