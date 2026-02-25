import { requireCoachSession, getVideoById } from "@/lib/data/coach";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { VideoEditor } from "./_video-editor";

export const metadata = { title: "Video Editor — Podium Throws" };

export default async function VideoDetailPage({
  params,
}: {
  params: { id: string };
}) {
  let coach;
  try {
    const session = await requireCoachSession();
    coach = session.coach;
  } catch {
    redirect("/login");
  }

  const video = await getVideoById(params.id, coach.id);
  if (!video) notFound();

  // Fetch athletes for the share modal
  const athletes = await prisma.athleteProfile.findMany({
    where: { coachId: coach.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const athleteList = athletes.map((a) => ({
    id: a.id,
    name: `${a.firstName} ${a.lastName}`,
  }));

  return (
    <VideoEditor
      video={video}
      athletes={athleteList}
    />
  );
}
