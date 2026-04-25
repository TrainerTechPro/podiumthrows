import { redirect } from "next/navigation";
import { getSession, canActAsAthlete } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { LogSessionWizard } from "./_log-session-wizard";

export default async function AthleteLogSessionPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Allow athletes OR coaches in training mode (who have an AthleteProfile
  // linked to their userId). canActAsAthlete() verifies via DB, not the
  // client-writable active-mode cookie. A coach without a training-mode
  // opt-in will fail the check and get bounced to their own dashboard.
  if (!(await canActAsAthlete(session))) {
    redirect("/coach/dashboard");
  }

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { events: true },
  });

  if (!athlete) redirect("/login");

  return (
    <div className="py-6 px-4">
      <LogSessionWizard userId={session.userId} allowedEvents={athlete.events ?? []} />
    </div>
  );
}
