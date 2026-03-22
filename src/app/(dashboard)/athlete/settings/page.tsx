import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAthleteProfileFull } from "@/lib/data/athlete";
import prisma from "@/lib/prisma";
import { Avatar } from "@/components";
import { AthleteSettingsForm } from "./_form";
import { WhoopCard } from "./_whoop-card";

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

  const whoopConnection = await prisma.whoopConnection.findUnique({
    where: { athleteId: profile.id },
    select: { syncMode: true, lastSyncAt: true },
  });

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

      {/* Integrations */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Integrations</h2>
        <WhoopCard
          connected={!!whoopConnection}
          syncMode={whoopConnection?.syncMode}
          lastSyncAt={whoopConnection?.lastSyncAt?.toISOString() ?? null}
        />
      </section>
    </div>
  );
}
