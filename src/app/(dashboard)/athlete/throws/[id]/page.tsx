import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAthlete } from "@/lib/authorize";
import { logger } from "@/lib/logger";
import {
  parseSessionView,
  parseThrowsStatus,
  isThrowsRecapStatus,
  type SessionView,
} from "@/lib/sessions/types";
import { AthleteThrowsLive } from "./live";
import { AthleteThrowsRecap } from "./recap";

export const dynamic = "force-dynamic";

function defaultViewForStatus(status: string | null): SessionView {
  return isThrowsRecapStatus(parseThrowsStatus(status)) ? "recap" : "live";
}

export default async function AthleteThrowsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { id } = await params;
  const { view: rawView } = await searchParams;

  const currentUser = await getCurrentUser();
  if (!currentUser) notFound();

  const assignment = await prisma.throwsAssignment.findUnique({
    where: { id },
    include: {
      session: { include: { blocks: { orderBy: { position: "asc" } } } },
      throwLogs: { orderBy: { throwNumber: "asc" } },
      athlete: { include: { user: { select: { id: true, email: true } } } },
    },
  });

  if (!assignment) notFound();

  const hasAccess = await canAccessAthlete(
    currentUser.userId,
    currentUser.role as "COACH" | "ATHLETE",
    assignment.athleteId
  );
  if (!hasAccess) {
    logger.warn("Throws assignment access denied", {
      metadata: {
        assignmentId: assignment.id,
        callerId: currentUser.userId,
        callerRole: currentUser.role,
      },
    });
    notFound();
  }

  const requestedView = parseSessionView(rawView);
  if (requestedView == null) {
    const dv = defaultViewForStatus(assignment.status);
    redirect(`/athlete/throws/${id}?view=${dv}`);
  }

  if (requestedView === "recap") {
    return <AthleteThrowsRecap assignment={assignment} />;
  }

  return <AthleteThrowsLive assignment={assignment} />;
}
