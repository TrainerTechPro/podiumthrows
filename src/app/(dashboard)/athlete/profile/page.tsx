import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  Dumbbell,
  Mail,
  MessageCircle,
  Settings,
  ShieldCheck,
  Trophy,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { getSession, canActAsAthlete } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Avatar } from "@/components/ui/Avatar";
import { cn, formatEventType } from "@/lib/utils";
import { ProfileTabs } from "./_profile-tabs";
import type {
  ProfileData,
  ThrowsPRRecord,
  ThrowsInjuryRecord,
  ThrowsProfileSummary,
  EquipmentData,
} from "./_types";
import {
  safeCompetitionGoals,
  safeTrainingHistory,
  safeLifestyle,
  safeBodyComposition,
  safeStrengthNumbers,
  safeTechnicalProfile,
  safeMovementRestrictions,
  safeEquipment,
} from "./_types";

export default async function AthleteProfilePage() {
  const session = await getSession();
  if (!session || !(await canActAsAthlete(session))) redirect("/login");

  // Get athlete ID first — needed for all parallel queries
  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!athlete) redirect("/login");

  // Parallel data fetching
  const [profile, throwsPRs, injuries, throwsProfiles, equipment] = await Promise.all([
    prisma.athleteProfile.findUnique({
      where: { id: athlete.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        events: true,
        gender: true,
        dateOfBirth: true,
        avatarUrl: true,
        heightCm: true,
        weightKg: true,
        turnDirection: true,
        classStanding: true,
        gradYear: true,
        competitionGoals: true,
        trainingHistory: true,
        lifestyle: true,
        bodyComposition: true,
        strengthNumbers: true,
        technicalProfile: true,
        movementRestrictions: true,
        user: { select: { email: true } },
      },
    }),
    // Catalog-keyed PRs (one row per (athleteId, implementId) by uniqueness
    // constraint — no label-format dupes). Sources both ThrowLog AND
    // AthleteDrillLog data via recomputeAthleteImplementPR.
    prisma.athleteImplementPR.findMany({
      where: { athleteId: athlete.id, bestDistance: { not: null } },
      orderBy: { bestDistance: "desc" },
      include: {
        implement: {
          select: { throwType: true, displayLabel: true, weightKg: true },
        },
      },
    }),
    prisma.throwsInjury.findMany({
      where: { athleteId: athlete.id },
      orderBy: { injuryDate: "desc" },
    }),
    prisma.throwsProfile.findMany({
      where: { athleteId: athlete.id },
      select: {
        event: true,
        competitionPb: true,
        currentDistanceBand: true,
      },
    }),
    prisma.equipmentInventory.findUnique({
      where: { athleteId: athlete.id },
    }),
  ]);

  if (!profile) redirect("/login");

  // Serialize dates and cast JSON fields
  const profileData: ProfileData = {
    id: profile.id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    events: profile.events,
    gender: profile.gender,
    dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.toISOString().split("T")[0] : null,
    avatarUrl: profile.avatarUrl,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    turnDirection: profile.turnDirection,
    classStanding: profile.classStanding,
    gradYear: profile.gradYear,
    competitionGoals: safeCompetitionGoals(profile.competitionGoals),
    trainingHistory: safeTrainingHistory(profile.trainingHistory),
    lifestyle: safeLifestyle(profile.lifestyle),
    bodyComposition: safeBodyComposition(profile.bodyComposition),
    strengthNumbers: safeStrengthNumbers(profile.strengthNumbers),
    technicalProfile: safeTechnicalProfile(profile.technicalProfile),
    movementRestrictions: safeMovementRestrictions(profile.movementRestrictions),
    email: profile.user.email,
  };

  const serializedPRs: ThrowsPRRecord[] = throwsPRs
    .filter((pr) => pr.bestDistance != null && pr.bestAchievedAt != null)
    .map((pr) => ({
      id: pr.id,
      // ImplementType (SHOT) → EventType string the component expects (SHOT_PUT).
      event: pr.implement.throwType === "SHOT" ? "SHOT_PUT" : pr.implement.throwType,
      implement: pr.implement.displayLabel,
      distance: pr.bestDistance!,
      achievedAt: pr.bestAchievedAt!.toISOString().slice(0, 10),
      source: pr.bestContext === "COMPETITION" ? "COMPETITION" : "TRAINING",
    }));

  const serializedInjuries: ThrowsInjuryRecord[] = injuries.map((inj) => ({
    id: inj.id,
    injuryDate: inj.injuryDate,
    returnToThrowDate: inj.returnToThrowDate,
    fullReturnDate: inj.fullReturnDate,
    bodyPart: inj.bodyPart,
    side: inj.side,
    severity: inj.severity,
    type: inj.type,
    throwsBanned: inj.throwsBanned,
    heavyBanned: inj.heavyBanned,
    strengthBanned: inj.strengthBanned,
    modifiedLoad: inj.modifiedLoad,
    description: inj.description,
    treatmentPlan: inj.treatmentPlan,
    recovered: inj.recovered,
    recoveredDate: inj.recoveredDate,
  }));

  const serializedProfiles: ThrowsProfileSummary[] = throwsProfiles.map((tp) => ({
    event: tp.event,
    competitionPb: tp.competitionPb,
    currentDistanceBand: tp.currentDistanceBand,
  }));

  const equipmentData: EquipmentData = safeEquipment(equipment);
  const profileSummary = buildProfileSummary({
    profile: profileData,
    throwsPRs: serializedPRs,
    injuries: serializedInjuries,
    throwsProfiles: serializedProfiles,
    equipment: equipmentData,
  });

  return (
    <div className="space-y-8">
      <ProfileCommandCenter profile={profileData} summary={profileSummary} />

      <section id="profile-editor" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-nano font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Profile editor
            </p>
            <h2 className="mt-1 font-heading text-section font-semibold text-[var(--foreground)]">
              Keep the engine honest.
            </h2>
          </div>
          <Link
            href="/athlete/settings"
            className="hidden min-h-[44px] shrink-0 items-center gap-2 rounded-xl border border-[var(--card-border)] px-4 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-surface-50 sm:inline-flex dark:hover:bg-surface-900"
          >
            <Settings size={16} strokeWidth={1.75} aria-hidden="true" />
            Settings
          </Link>
        </div>

        <ProfileTabs
          profile={profileData}
          throwsPRs={serializedPRs}
          injuries={serializedInjuries}
          throwsProfiles={serializedProfiles}
          equipment={equipmentData}
        />
      </section>
    </div>
  );
}

/* ─── Profile command center ─────────────────────────────────────────────
   The bottom tab is now an identity/control surface, not a dumping ground.
   First screen answers: who am I in the system, what is profile-ready, and
   where are account controls? Editing stays below as a deliberate second act. */

type ProfileSummary = ReturnType<typeof buildProfileSummary>;

interface SummaryInput {
  profile: ProfileData;
  throwsPRs: ThrowsPRRecord[];
  injuries: ThrowsInjuryRecord[];
  throwsProfiles: ThrowsProfileSummary[];
  equipment: EquipmentData;
}

function buildProfileSummary({
  profile,
  throwsPRs,
  injuries,
  throwsProfiles,
  equipment,
}: SummaryInput) {
  const hasAnyLift = profile.strengthNumbers
    ? Object.values(profile.strengthNumbers.lifts).some((entry) => entry.current > 0)
    : false;
  const completedSections = [
    profile.events.length > 0 && !!profile.turnDirection && !!profile.classStanding,
    !!profile.trainingHistory?.yearsTraining,
    !!profile.lifestyle?.sleepHours,
    hasAnyLift,
    equipment.implements.length > 0 || !!equipment.facility,
    throwsProfiles.some((p) => p.competitionPb != null || p.currentDistanceBand),
    !!profile.movementRestrictions || injuries.length === 0,
  ].filter(Boolean).length;
  const totalSections = 7;
  const readinessPct = Math.round((completedSections / totalSections) * 100);
  const primaryEvent = profile.events[0] ? formatEventType(profile.events[0]) : "Event not set";
  const topPR = throwsPRs[0] ?? null;
  const activeInjuries = injuries.filter((inj) => !inj.recovered).length;
  const trainingAge =
    profile.trainingHistory?.yearsTraining != null
      ? `${profile.trainingHistory.yearsTraining} yr`
      : "Unset";
  const equipmentCount = equipment.implements.length;

  return {
    readinessPct,
    completedSections,
    totalSections,
    primaryEvent,
    topPR,
    activeInjuries,
    trainingAge,
    equipmentCount,
    hasAnyLift,
  };
}

function ProfileCommandCenter({
  profile,
  summary,
}: {
  profile: ProfileData;
  summary: ProfileSummary;
}) {
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const classLine = [profile.classStanding, profile.gradYear ? `Class ${profile.gradYear}` : null]
    .filter(Boolean)
    .join(" · ");
  const ringStyle = {
    background: `conic-gradient(var(--color-brand) ${summary.readinessPct}%, var(--card-border) 0)`,
  };

  return (
    <section className="space-y-4" aria-labelledby="profile-heading">
      <div className="overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]">
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={fullName} src={profile.avatarUrl} size="lg" />
              <div className="min-w-0">
                <p className="text-nano font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Athlete profile
                </p>
                <h1
                  id="profile-heading"
                  className="mt-1 font-heading text-section font-semibold leading-tight text-[var(--foreground)] sm:text-title"
                >
                  {fullName}
                </h1>
                <p className="mt-1 truncate text-sm text-[var(--muted)]">
                  {summary.primaryEvent}
                  {classLine ? ` · ${classLine}` : ""}
                </p>
              </div>
            </div>
            <div
              className="grid h-14 w-14 shrink-0 place-items-center rounded-full p-1"
              style={ringStyle}
              aria-label={`Profile readiness ${summary.readinessPct}%`}
            >
              <div className="grid h-full w-full place-items-center rounded-full bg-[var(--card-bg)]">
                <span className="font-mono text-xs font-semibold tabular-nums text-[var(--foreground)]">
                  {summary.readinessPct}%
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {profile.events.length > 0 ? (
              profile.events.map((event) => (
                <EventPill key={event} label={formatEventType(event)} />
              ))
            ) : (
              <EventPill label="Choose events" muted />
            )}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <PassportStat
              label="Ready"
              value={`${summary.completedSections}/${summary.totalSections}`}
            />
            <PassportStat label="Training" value={summary.trainingAge} />
            <PassportStat
              label="Health"
              value={summary.activeInjuries > 0 ? `${summary.activeInjuries} flag` : "Clear"}
              tone={summary.activeInjuries > 0 ? "warning" : "success"}
            />
          </div>
        </div>

        <div className="grid border-t border-[var(--card-border)] sm:grid-cols-3">
          <QuickLink
            href="/athlete/settings"
            icon={Settings}
            label="Settings"
            description="Security, theme, notifications"
          />
          <QuickLink
            href="/athlete/settings/notifications"
            icon={Mail}
            label="Notifications"
            description="Training and reminder rhythm"
          />
          <QuickLink
            href="/athlete/feedback"
            icon={MessageCircle}
            label="Feedback"
            description="Send what feels off"
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <SignalTile
          icon={Trophy}
          label="Top PR"
          value={summary.topPR ? `${summary.topPR.distance.toFixed(2)}m` : "No PR yet"}
          detail={
            summary.topPR
              ? `${formatEventType(summary.topPR.event)} · ${summary.topPR.implement}`
              : "Log a mark to start"
          }
          tone="brand"
        />
        <SignalTile
          icon={Wrench}
          label="Implements"
          value={summary.equipmentCount > 0 ? `${summary.equipmentCount}` : "Unset"}
          detail={
            summary.equipmentCount > 0 ? "Available weights saved" : "Tell the engine what you own"
          }
        />
        <SignalTile
          icon={Dumbbell}
          label="Strength"
          value={summary.hasAnyLift ? "Logged" : "Missing"}
          detail={summary.hasAnyLift ? "Transfer numbers are available" : "Add one key lift"}
        />
        <SignalTile
          icon={ShieldCheck}
          label="Restrictions"
          value={summary.activeInjuries > 0 ? "Review" : "Clear"}
          detail={
            summary.activeInjuries > 0
              ? "Active injury flags need context"
              : "No active injury flags"
          }
          tone={summary.activeInjuries > 0 ? "warning" : "success"}
        />
      </div>
    </section>
  );
}

function EventPill({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold",
        muted
          ? "border-dashed border-[var(--card-border)] text-[var(--muted)]"
          : "border-primary-500/25 bg-primary-500/10 text-primary-600 dark:text-primary-300"
      )}
    >
      {label}
    </span>
  );
}

function PassportStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "neutral";
}) {
  const toneClass =
    tone === "success"
      ? "text-success-500"
      : tone === "warning"
        ? "text-warning-500"
        : "text-[var(--foreground)]";

  return (
    <div className="min-w-0">
      <p className="text-nano font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </p>
      <p className={cn("mt-1 truncate font-mono text-lg font-semibold tabular-nums", toneClass)}>
        {value}
      </p>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[64px] items-center gap-3 border-b border-[var(--card-border)] px-5 py-3 transition-colors hover:bg-surface-50 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 dark:hover:bg-surface-900"
    >
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--muted-bg)] text-[var(--foreground)]"
        aria-hidden="true"
      >
        <Icon size={17} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--foreground)]">{label}</span>
        <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{description}</span>
      </span>
      <ChevronRight size={16} strokeWidth={1.75} className="shrink-0 text-[var(--muted)]" />
    </Link>
  );
}

function SignalTile({
  icon: Icon,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone?: "brand" | "success" | "warning" | "neutral";
}) {
  const toneClass =
    tone === "brand"
      ? "text-primary-600 dark:text-primary-300"
      : tone === "success"
        ? "text-success-500"
        : tone === "warning"
          ? "text-warning-500"
          : "text-[var(--foreground)]";

  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
      <div className="flex items-center gap-2 text-[var(--muted)]">
        <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
        <p className="text-nano font-semibold uppercase tracking-[0.16em]">{label}</p>
      </div>
      <p className={cn("mt-3 truncate font-mono text-xl font-semibold tabular-nums", toneClass)}>
        {value}
      </p>
      <p className="mt-1 text-sm leading-snug text-[var(--muted)]">{detail}</p>
    </div>
  );
}
