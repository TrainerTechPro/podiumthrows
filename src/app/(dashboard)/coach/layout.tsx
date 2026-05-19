import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DashboardLayout, type DashboardUser } from "@/components";
import { getCoachNavSections } from "@/components/ui/coach-nav-sections";
import { fetchCoachByUserId } from "@/lib/data/coach";
import { getUnreadCount } from "@/lib/notifications";
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

  // MVP cut (2026-05-15): sideline + video-analysis are flag-gated. Resolve
  // both server-side so the sidebar entry and the SidelineFAB never point at
  // routes the middleware would immediately redirect away from. See
  // tasks/navigation-contract-2026-05-18.md.
  const [sidelineEnabled, videoAnalysisEnabled] = await Promise.all([
    isFeatureEnabledAnyTier("coachSideline"),
    isFeatureEnabledAnyTier("videoAnalysis"),
  ]);

  const navSections = getCoachNavSections({ videoAnalysisEnabled });

  return (
    <UnitPrefsProvider initial={unitPrefs}>
      <DashboardLayout user={user} notificationCount={notificationCount} navSections={navSections}>
        {children}
        {sidelineEnabled && <SidelineFAB />}
      </DashboardLayout>
    </UnitPrefsProvider>
  );
}
