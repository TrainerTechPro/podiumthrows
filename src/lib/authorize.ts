import prisma from "@/lib/prisma";

/**
 * Check if a user can access a specific athlete's data.
 * - Athletes can only see their own data
 * - Coaches can see data for athletes they coach
 */
export async function canAccessAthlete(
  userId: string,
  role: "COACH" | "ATHLETE",
  athleteId: string
): Promise<boolean> {
  if (role === "ATHLETE") {
    const profile = await prisma.athleteProfile.findFirst({
      where: { id: athleteId, userId },
      select: { id: true },
    });
    return !!profile;
  }

  if (role === "COACH") {
    const coachProfile = await prisma.coachProfile.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!coachProfile) return false;

    const athlete = await prisma.athleteProfile.findFirst({
      where: { id: athleteId, coachId: coachProfile.id },
      select: { id: true },
    });
    return !!athlete;
  }

  return false;
}

/**
 * Check if a user can access a specific training session.
 * - Athletes can only see sessions assigned to them
 * - Coaches can see sessions for any of their athletes
 */
export async function canAccessSession(
  userId: string,
  role: "COACH" | "ATHLETE",
  sessionId: string
): Promise<boolean> {
  if (role === "ATHLETE") {
    const profile = await prisma.athleteProfile.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return false;

    const session = await prisma.trainingSession.findFirst({
      where: { id: sessionId, athleteId: profile.id },
      select: { id: true },
    });
    return !!session;
  }

  if (role === "COACH") {
    const coachProfile = await prisma.coachProfile.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!coachProfile) return false;

    const session = await prisma.trainingSession.findFirst({
      where: {
        id: sessionId,
        athlete: { coachId: coachProfile.id },
      },
      select: { id: true },
    });
    return !!session;
  }

  return false;
}

/**
 * Check if a user can access a specific training program.
 * - Athletes can only see programs assigned to them
 * - Coaches can see programs for athletes they coach
 */
export async function canAccessProgram(
  userId: string,
  role: "COACH" | "ATHLETE",
  programId: string
): Promise<boolean> {
  const program = await prisma.trainingProgram.findUnique({
    where: { id: programId },
    select: {
      athleteId: true,
      athlete: { select: { coachId: true, userId: true } },
    },
  });
  if (!program) return false;

  if (role === "ATHLETE") {
    return program.athlete.userId === userId;
  }

  if (role === "COACH") {
    const coachProfile = await prisma.coachProfile.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!coachProfile) return false;
    return program.athlete.coachId === coachProfile.id;
  }

  return false;
}

/**
 * Get the coach profile for a user. Returns null if user is not a coach.
 */
export async function getCoachProfile(userId: string) {
  return prisma.coachProfile.findUnique({
    where: { userId },
  });
}

/**
 * Get the athlete profile for a user. Returns null if user is not an athlete.
 */
export async function getAthleteProfile(userId: string) {
  return prisma.athleteProfile.findUnique({
    where: { userId },
  });
}

/**
 * Check if a user can access a specific voice note.
 * - Creator (coach or athlete who created it) can access
 * - If tied to a session, the session's athlete or their coach can access
 */
export async function canAccessVoiceNote(
  userId: string,
  role: "COACH" | "ATHLETE",
  noteId: string
): Promise<boolean> {
  const note = await prisma.voiceNote.findUnique({
    where: { id: noteId },
    select: {
      coachId: true,
      athleteId: true,
      sessionId: true,
      coach: { select: { userId: true } },
      athlete: { select: { userId: true } },
    },
  });
  if (!note) return false;

  if (note.coach?.userId === userId) return true;
  if (note.athlete?.userId === userId) return true;

  if (note.sessionId) {
    return canAccessSession(userId, role, note.sessionId);
  }

  return false;
}
