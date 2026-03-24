import { redirect } from "next/navigation";
import { getSession, canActAsAthlete } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { ProfileTabs } from "./_profile-tabs";
import type {
  ProfileData,
  CompetitionGoalsMap,
  StrengthNumbersData,
  TechnicalProfileData,
  MovementRestrictionsData,
  ThrowsPRRecord,
  ThrowsInjuryRecord,
  ThrowsProfileSummary,
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
    dateOfBirth: profile.dateOfBirth
      ? profile.dateOfBirth.toISOString().split("T")[0]
      : null,
    avatarUrl: profile.avatarUrl,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    turnDirection: profile.turnDirection,
    classStanding: profile.classStanding,
    gradYear: profile.gradYear,
    competitionGoals: (profile.competitionGoals as CompetitionGoalsMap) ?? null,
    strengthNumbers: (profile.strengthNumbers as StrengthNumbersData) ?? null,
    technicalProfile: (profile.technicalProfile as TechnicalProfileData) ?? null,
    movementRestrictions:
      (profile.movementRestrictions as MovementRestrictionsData) ?? null,
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

  const serializedProfiles: ThrowsProfileSummary[] = throwsProfiles.map(
    (tp) => ({
      event: tp.event,
      competitionPb: tp.competitionPb,
      currentDistanceBand: tp.currentDistanceBand,
    })
  );

  return (
    <div className="space-y-6">
      <ScrollProgressBar />
      <ProfileTabs
        profile={profileData}
        throwsPRs={serializedPRs}
        injuries={serializedInjuries}
        throwsProfiles={serializedProfiles}
      />
    </div>
  );
}
