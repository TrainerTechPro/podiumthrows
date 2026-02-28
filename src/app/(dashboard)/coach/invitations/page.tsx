import { requireCoachSession, PLAN_LIMITS } from "@/lib/data/coach";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { InviteAthleteButton } from "../athletes/_invite";
import { InvitationsClient } from "./_invitations-client";
import type { PlanName } from "@/lib/stripe";

export const metadata = { title: "Invitations — Podium Throws" };

export default async function InvitationsPage() {
  let coach: Awaited<ReturnType<typeof requireCoachSession>>["coach"];
  try {
    const result = await requireCoachSession();
    coach = result.coach;
  } catch {
    redirect("/login");
  }

  const [invitations, athleteCount] = await Promise.all([
    prisma.invitation.findMany({
      where: { coachId: coach.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        email: true,
        token: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    }),
    prisma.athleteProfile.count({ where: { coachId: coach.id } }),
  ]);

  const planLimit = PLAN_LIMITS[coach.plan] ?? 3;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            Athlete Invitations
          </h1>
          <p className="text-sm text-muted mt-1">
            Invite athletes to join your roster. They receive an email and you can also share the link directly.
            {planLimit !== Infinity && (
              <span className="ml-1">
                {athleteCount} / {planLimit} roster spots used.
              </span>
            )}
          </p>
        </div>
        <InviteAthleteButton
          athleteCount={athleteCount}
          planLimit={planLimit}
          currentPlan={coach.plan as PlanName}
        />
      </div>

      <InvitationsClient
        initialInvitations={invitations.map((inv) => ({
          ...inv,
          expiresAt: inv.expiresAt.toISOString(),
          createdAt: inv.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
