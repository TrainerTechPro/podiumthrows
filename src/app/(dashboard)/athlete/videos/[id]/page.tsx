import { requireAthleteSession, getAthleteVideoById } from "@/lib/data/athlete";
import { redirect, notFound } from "next/navigation";
import { AthleteVideoViewer } from "./_video-viewer";

export const metadata = { title: "Video — Podium Throws" };

export default async function AthleteVideoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let athlete;
  try {
    const session = await requireAthleteSession();
    athlete = session.athlete;
  } catch {
    redirect("/login");
  }

  const video = await getAthleteVideoById(id, athlete.id);
  if (!video) notFound();

  return <AthleteVideoViewer video={video} />;
}
