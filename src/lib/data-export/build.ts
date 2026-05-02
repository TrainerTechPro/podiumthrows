import prisma from "@/lib/prisma";
import { redactSensitive } from "./redact";
import { EXPORT_SCHEMA_VERSION, type ExportEnvelope, type ExportMeta } from "./types";

const SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Build the export envelope for the given user. Dispatches on role.
 * Throws if the user is not found OR if the user has no profile row
 * for their role (data-integrity issue — should not happen in prod).
 */
export async function buildExportForUser(userId: string): Promise<ExportEnvelope<unknown>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!user) throw new Error(`User ${userId} not found`);

  const data =
    user.role === "COACH" ? await buildCoachExport(userId) : await buildAthleteExport(userId);

  const meta: ExportMeta = {
    exportedAt: new Date().toISOString(),
    userId,
    role: user.role as "COACH" | "ATHLETE",
    schemaVersion: EXPORT_SCHEMA_VERSION,
    signedUrlExpiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
  };

  return { _meta: meta, data: redactSensitive(data) };
}

// ─── Coach ──────────────────────────────────────────────────────────────────

export async function buildCoachExport(userId: string): Promise<Record<string, unknown>> {
  const coach = await prisma.coachProfile.findUnique({
    where: { userId },
    include: {
      user: true,
      invitations: true,
      drills: true,
      coachNotes: true,
      voiceNotes: true,
      questionnaires: true,
      coachPRs: true,
      coachTyping: true,
      athletes: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          events: true,
          createdAt: true,
          user: { select: { email: true, claimedAt: true } },
        },
      },
    },
  });
  if (!coach) throw new Error(`CoachProfile not found for user ${userId}`);

  // Models not directly hung off CoachProfile — fire in parallel.
  const [betaFeedback, trainingPrograms] = await Promise.all([
    prisma.betaFeedback.findMany({ where: { userId } }),
    prisma.trainingProgram.findMany({ where: { coachId: coach.id } }),
  ]);

  const { user, athletes, ...coachFields } = coach;

  return {
    user,
    coachProfile: coachFields,
    roster: athletes,
    trainingPrograms,
    feedbackSubmitted: betaFeedback,
  };
}

// ─── Athlete ────────────────────────────────────────────────────────────────

export async function buildAthleteExport(userId: string): Promise<Record<string, unknown>> {
  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId },
    include: {
      user: true,
      smartGoals: true,
      injuries: true,
      readinessCheckIns: true,
      assessments: true,
      throwLogs: true,
      throwsPRs: true,
      throwsDrillPRs: true,
      athleteImplementPRs: true,
      voiceNotes: true,
      coachNotes: true,
      trainingSessions: true,
      whoopConnection: true,
      ouraConnection: true,
      throwsTyping: true,
    },
  });
  if (!athlete) throw new Error(`AthleteProfile not found for user ${userId}`);

  const [betaFeedback] = await Promise.all([prisma.betaFeedback.findMany({ where: { userId } })]);

  const { user, ...athleteFields } = athlete;

  return {
    user,
    athleteProfile: athleteFields,
    feedbackSubmitted: betaFeedback,
  };
}
