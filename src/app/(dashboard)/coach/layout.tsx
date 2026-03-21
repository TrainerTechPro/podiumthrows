import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DashboardLayout, type DashboardUser } from "@/components";
import { fetchCoachByUserId, getUnreadNotificationCount } from "@/lib/data/coach";

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || session.role !== "COACH") redirect("/login");

  const coach = await fetchCoachByUserId(session.userId);

  if (!coach) redirect("/login");

  // Fetch activeMode for the mode toggle
  const dbUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { activeMode: true },
  });

  const user: DashboardUser = {
    name: `${coach.firstName} ${coach.lastName}`,
    email: session.email,
    role: "COACH",
    avatarUrl: coach.avatarUrl,
    plan: coach.plan,
    trainingEnabled: coach.trainingEnabled,
    activeMode: dbUser?.activeMode ?? "COACH",
  };

  const notificationCount = await getUnreadNotificationCount(coach.id);

  return (
    <DashboardLayout user={user} notificationCount={notificationCount}>
      {children}
    </DashboardLayout>
  );
}
