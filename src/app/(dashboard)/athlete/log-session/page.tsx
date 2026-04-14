import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { LogSessionWizard } from "./_log-session-wizard";

export default async function AthleteLogSessionPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Coaches don't log their own athlete sessions through this route —
  // their equivalent lives under /coach. Without this redirect, the
  // AthleteProfile lookup returns null, the wizard shows all events
  // (bug H4), and a save would 404 server-side anyway.
  if (session.role !== "ATHLETE") {
    redirect("/coach/dashboard");
  }

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { events: true },
  });

  if (!athlete) redirect("/login");

  return (
    <div className="py-6 px-4">
      <ScrollProgressBar />
      <LogSessionWizard allowedEvents={athlete.events ?? []} />
    </div>
  );
}
