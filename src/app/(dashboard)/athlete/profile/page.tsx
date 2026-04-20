import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Target,
  Sparkles,
  BookOpen,
  Video,
  FileText,
  ClipboardList,
  Trophy,
  MessageCircle,
  ChevronRight,
} from "lucide-react";
import { getSession, canActAsAthlete } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ProfileTabs } from "./_profile-tabs";
import type {
  ProfileData,
  ThrowsPRRecord,
  ThrowsInjuryRecord,
  ThrowsProfileSummary,
} from "./_types";
import {
  safeCompetitionGoals,
  safeStrengthNumbers,
  safeTechnicalProfile,
  safeMovementRestrictions,
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
  const [profile, throwsPRs, injuries, throwsProfiles] = await Promise.all([
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
        strengthNumbers: true,
        technicalProfile: true,
        movementRestrictions: true,
        user: { select: { email: true } },
      },
    }),
    prisma.throwsPR.findMany({
      where: { athleteId: athlete.id },
      orderBy: [{ event: "asc" }, { distance: "desc" }],
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
    strengthNumbers: safeStrengthNumbers(profile.strengthNumbers),
    technicalProfile: safeTechnicalProfile(profile.technicalProfile),
    movementRestrictions: safeMovementRestrictions(profile.movementRestrictions),
    email: profile.user.email,
  };

  const serializedPRs: ThrowsPRRecord[] = throwsPRs.map((pr) => ({
    id: pr.id,
    event: pr.event,
    implement: pr.implement,
    distance: pr.distance,
    achievedAt: pr.achievedAt,
    source: pr.source,
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

  return (
    <div className="space-y-10">
      <ProfileTabs
        profile={profileData}
        throwsPRs={serializedPRs}
        injuries={serializedInjuries}
        throwsProfiles={serializedProfiles}
      />

      <MoreMenu />
    </div>
  );
}

/* ─── More Menu ───────────────────────────────────────────────────────────
   The athlete bottom tab bar has 5 slots — home, training, log, trends, me.
   Pages that don't fit any of those land here. Grouped by purpose so the
   list scans: Program (goals/questionnaires/assessments), Reference
   (drill library/videos), Records (achievements), plus a feedback link.

   Icons are Lucide + amber brand-subtle circles; rows are 44pt minimum
   tap targets with a chevron affordance. No card chrome — plain rows,
   editorial rhythm with the ProfileTabs above. */

interface MenuLink {
  href: string;
  label: string;
  description: string;
  icon: typeof Target;
}

const PROGRAM_LINKS: MenuLink[] = [
  {
    href: "/athlete/goals",
    label: "Goals",
    description: "Set targets, track progress",
    icon: Target,
  },
  {
    href: "/athlete/questionnaires",
    label: "Questionnaires",
    description: "Forms your coach has sent",
    icon: ClipboardList,
  },
  {
    href: "/athlete/assessments",
    label: "Assessments",
    description: "Self-assessments & check-ins",
    icon: FileText,
  },
];

const REFERENCE_LINKS: MenuLink[] = [
  {
    href: "/athlete/insights",
    label: "Insights",
    description: "Trends in readiness & load",
    icon: Sparkles,
  },
  {
    href: "/athlete/codex",
    label: "Technique codex",
    description: "Drill and cue reference",
    icon: BookOpen,
  },
  {
    href: "/athlete/drill-videos",
    label: "My drill videos",
    description: "Your recorded throws",
    icon: Video,
  },
  {
    href: "/athlete/videos",
    label: "Coach videos",
    description: "Clips your coach shared",
    icon: Video,
  },
];

const RECORDS_LINKS: MenuLink[] = [
  {
    href: "/athlete/achievements",
    label: "Achievements",
    description: "Badges and milestones",
    icon: Trophy,
  },
];

function MenuSection({ title, links }: { title: string; links: MenuLink[] }) {
  return (
    <section>
      <h2 className="px-1 mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
        {title}
      </h2>
      <ul className="divide-y divide-[var(--color-border-default)] border-t border-b border-[var(--color-border-default)]">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex items-center gap-3.5 min-h-[56px] -mx-2 px-2 hover:bg-[var(--color-bg-surface-sunken)] transition-colors"
              >
                <span
                  className="w-9 h-9 rounded-full bg-[var(--color-brand-subtle)] flex items-center justify-center shrink-0"
                  aria-hidden="true"
                >
                  <Icon
                    size={16}
                    strokeWidth={1.75}
                    style={{ color: "var(--color-brand-strong)" }}
                  />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-[var(--color-text-primary)]">
                    {link.label}
                  </span>
                  <span className="block text-xs text-[var(--color-text-secondary)] mt-0.5">
                    {link.description}
                  </span>
                </span>
                <ChevronRight
                  size={16}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className="shrink-0 text-[var(--color-text-secondary)]"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MoreMenu() {
  return (
    <div className="space-y-6">
      <MenuSection title="Program" links={PROGRAM_LINKS} />
      <MenuSection title="Reference" links={REFERENCE_LINKS} />
      <MenuSection title="Records" links={RECORDS_LINKS} />

      <div className="pt-2">
        <Link
          href="/athlete/feedback"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <MessageCircle size={14} strokeWidth={1.75} aria-hidden="true" />
          Send feedback
        </Link>
      </div>
    </div>
  );
}
