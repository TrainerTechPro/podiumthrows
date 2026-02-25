import { requireAthleteSession, getAthleteVideoById } from "@/lib/data/athlete";
import { redirect, notFound } from "next/navigation";
import { AthleteVideoViewer } from "./_video-viewer";

export const metadata = { title: "Video — Podium Throws" };

export default async function AthleteVideoDetailPage({
  params,
}: {
  params: { id: string };
}) {
  let athlete;
  try {
    const session = await requireAthleteSession();
    athlete = session.athlete;
  } catch {
    redirect("/login");
  }

  const video = await getAthleteVideoById(params.id, athlete.id);
  if (!video) notFound();

  return <AthleteVideoViewer video={video} />;
}
