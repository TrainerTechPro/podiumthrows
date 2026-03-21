import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DashboardLayout, type DashboardUser } from "@/components";

export default async function AthleteLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const isCoachTraining = session.role === "COACH";
  if (session.role !== "ATHLETE" && !isCoachTraining) redirect("/login");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: {
      firstName: true,
      lastName: true,
      avatarUrl: true,
      events: true,
      user: { select: { email: true } },
    },
  });

  if (!athlete) {
    redirect(isCoachTraining ? "/coach/dashboard" : "/login");
  }

  const user: DashboardUser = {
    name: `${athlete.firstName} ${athlete.lastName}`,
    email: athlete.user.email,
    role: session.role as "COACH" | "ATHLETE",
    avatarUrl: athlete.avatarUrl ?? undefined,
    activeMode: isCoachTraining ? "TRAINING" : undefined,
    trainingEnabled: isCoachTraining,
  };

  return <DashboardLayout user={user}>{children}</DashboardLayout>;
}
