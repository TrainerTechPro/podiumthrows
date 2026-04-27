import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAthleteProfileFull } from "@/lib/data/athlete";
import prisma from "@/lib/prisma";
import { getPushPreferences } from "@/lib/push/preferences";
import { logger } from "@/lib/logger";
import { AthleteSettingsTabs } from "./_settings-tabs";

export const metadata = { title: "Settings — Podium Throws" };

/* ─── /athlete/settings ─────────────────────────────────────────────────────
   Single tabbed surface — 5 tabs: Profile / Notifications / Integrations /
   Privacy / Account. Deep-linkable via ?tab=. The previous standalone
   /athlete/settings/notifications route now redirects here (see
   next.config.mjs).
   ───────────────────────────────────────────────────────────────────────── */

export default async function AthleteSettingsPage() {
  const session = await getSession();
  if (!session || (session.role !== "ATHLETE" && session.role !== "COACH")) redirect("/login");

  const profile = await getAthleteProfileFull(session.userId);
  if (!profile) redirect("/login");

  // Wearable connection count — drives the Integrations card subtitle.
  let connectedDevices = 0;
  try {
    const [whoop, oura] = await Promise.all([
      prisma.whoopConnection.findUnique({
        where: { athleteId: profile.id },
        select: { id: true },
      }),
      prisma.ouraConnection.findUnique({
        where: { athleteId: profile.id },
        select: { id: true },
      }),
    ]);
    if (whoop) connectedDevices++;
    if (oura) connectedDevices++;
  } catch (err) {
    logger.warn("wearable connection count failed", { context: "athlete/settings", error: err });
  }

  const notificationPreferences = await getPushPreferences(profile.id);

  return (
    <AthleteSettingsTabs
      profile={profile}
      connectedDevices={connectedDevices}
      notificationPreferences={notificationPreferences}
    />
  );
}
