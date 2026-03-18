import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { LogSessionWizard } from "./_log-session-wizard";

export default async function AthleteLogSessionPage() {
  const session = await getSession();
  if (!session || session.role !== "ATHLETE") redirect("/login");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { events: true },
  });

  return (
    <div className="py-6 px-4">
      <LogSessionWizard allowedEvents={athlete?.events ?? []} />
    </div>
  );
}
