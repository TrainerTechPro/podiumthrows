import { redirect } from "next/navigation";
import { requireCoachSession } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { LiveCapture } from "./_live-capture";

export const metadata = { title: "Live Capture — Video Analysis — Podium Throws" };

export default async function LiveCapturePage() {
  let coach;
  try {
    const session = await requireCoachSession();
    coach = session.coach;
  } catch {
    redirect("/login");
  }

  const athletes = await prisma.athleteProfile.findMany({
    where: { coachId: coach.id },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return <LiveCapture athletes={athletes} />;
}
