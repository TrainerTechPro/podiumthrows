import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DashboardLayout, type DashboardUser } from "@/components";
import { fetchCoachByUserId } from "@/lib/data/coach";
import { getUnreadCount } from "@/lib/notifications";
import { WhatsNewModal } from "@/components/feedback/WhatsNewModal";
import { SidelineFAB } from "@/components/coach/SidelineFAB";
import { isFeatureEnabledAnyTier } from "@/lib/flags";
import { UnitPrefsProvider } from "@/lib/units/provider";
import { parseUnitPrefs } from "@/lib/units/types";

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "COACH") redirect("/login");

  const coach = await fetchCoachByUserId(session.userId);

  if (!coach) redirect("/login");

  // Fetch activeMode + display-units for the mode toggle / unit prefs.
  const [dbUser, coachPrefs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { activeMode: true },
    }),
    prisma.coachProfile.findUnique({
      where: { userId: session.userId },
      select: { displayUnits: true },
    }),
  ]);

  const user: DashboardUser = {
    userId: session.userId,
    name: `${coach.firstName} ${coach.lastName}`,
    email: session.email,
    role: "COACH",
    avatarUrl: coach.avatarUrl,
    plan: coach.plan,
    trainingEnabled: coach.trainingEnabled,
    activeMode: dbUser?.activeMode ?? "COACH",
  };

  const notificationCount = await getUnreadCount(coach.id, "COACH");

  const unitPrefs = parseUnitPrefs(coachPrefs?.displayUnits);

  // MVP cut (2026-05-15): sideline is flag-gated. The FAB only renders when
  // the flag is on so it never points at a route the middleware would
  // immediately redirect away from.
  const sidelineEnabled = await isFeatureEnabledAnyTier("coachSideline");

  return (
    <UnitPrefsProvider initial={unitPrefs}>
      <DashboardLayout user={user} notificationCount={notificationCount}>
        {children}
        <WhatsNewModal />
        {sidelineEnabled && <SidelineFAB />}
      </DashboardLayout>
    </UnitPrefsProvider>
  );
}
