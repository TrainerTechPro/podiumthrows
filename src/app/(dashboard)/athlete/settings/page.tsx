import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, Zap, ChevronRight } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getAthleteProfileFull } from "@/lib/data/athlete";
import prisma from "@/lib/prisma";
import { Avatar } from "@/components";
import { AthleteSettingsForm } from "./_form";
import { QuickActionsSettings } from "@/components/ui/QuickActionsSettings";
import { FeedPrivacySettings } from "@/components/feedback/FeedPrivacySettings";
import { SendFeedbackCard } from "@/components/feedback/SendFeedbackCard";

import { logger } from "@/lib/logger";
/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default async function AthleteSettingsPage() {
  const session = await getSession();
  if (!session || (session.role !== "ATHLETE" && session.role !== "COACH")) redirect("/login");

  const profile = await getAthleteProfileFull(session.userId);
  if (!profile) redirect("/login");

  let connectedDevices = 0;
  try {
    const whoop = await prisma.whoopConnection.findUnique({
      where: { athleteId: profile.id },
      select: { id: true },
    });
    const oura = await prisma.ouraConnection.findUnique({
      where: { athleteId: profile.id },
      select: { id: true },
    });
    if (whoop) connectedDevices++;
    if (oura) connectedDevices++;
  } catch (err) {
    // Wearable tables can be missing in older dev DBs. Log so real DB
    // errors aren't silently hidden; the badge falls back to 0.
    logger.warn("wearable connection count failed", { context: "athlete/settings", error: err });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">Settings</h1>
        <p className="text-sm text-muted mt-0.5">Manage your athlete profile.</p>
      </div>

      {/* Profile card */}
      <div className="card px-5 py-5 flex items-center gap-4">
        <Avatar
          name={`${profile.firstName} ${profile.lastName}`}
          src={profile.avatarUrl}
          size="lg"
        />
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-[var(--foreground)]">
            {profile.firstName} {profile.lastName}
          </p>
          <p className="text-sm text-muted truncate">{profile.email}</p>
          <p className="text-xs text-muted mt-0.5">
            Member since {formatDate(profile.memberSince)}
            {profile.events.length > 0 && <> · {profile.events.map(formatEventName).join(", ")}</>}
          </p>
        </div>
      </div>

      {/* Coach card */}
      <div className="card px-5 py-4 flex items-center gap-3">
        <Avatar name={profile.coachName} src={profile.coachAvatar} size="sm" />
        <div className="min-w-0">
          <p className="text-xs text-muted uppercase tracking-wide">Your Coach</p>
          <p className="text-sm font-semibold text-[var(--foreground)]">{profile.coachName}</p>
        </div>
      </div>

      {/* Edit form */}
      <AthleteSettingsForm profile={profile} />

      {/* Quick Actions */}
      <QuickActionsSettings role="ATHLETE" />

      {/* Notifications */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Notifications</h2>
        <Link
          href="/athlete/settings/notifications"
          className="card card-interactive p-4 flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center shrink-0">
            <Bell size={20} className="text-primary-500" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[var(--foreground)]">Notifications</p>
            <p className="text-xs text-muted">Manage push notification preferences</p>
          </div>
          <ChevronRight size={20} className="text-muted" strokeWidth={1.75} aria-hidden="true" />
        </Link>
      </section>

      {/* Team Feed Privacy */}
      <FeedPrivacySettings />

      {/* Integrations link */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Integrations</h2>
        <Link
          href="/athlete/integrations"
          className="card card-interactive p-4 flex items-center gap-3"
        >
          <Zap size={20} strokeWidth={1.75} className="text-primary-500" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)]">Wearable Integrations</p>
            <p className="text-xs text-muted">
              {connectedDevices > 0
                ? `${connectedDevices} device${connectedDevices > 1 ? "s" : ""} connected`
                : "Connect WHOOP, Oura Ring, and more"}
            </p>
          </div>
          <ChevronRight size={16} strokeWidth={1.75} className="text-muted" aria-hidden="true" />
        </Link>
      </section>

      {/* Feedback */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Feedback</h2>
        <SendFeedbackCard />
      </section>
    </div>
  );
}
