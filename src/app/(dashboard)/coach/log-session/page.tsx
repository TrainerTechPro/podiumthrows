import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { LogSessionWizard } from "../../athlete/log-session/_log-session-wizard";

export default async function CoachLogSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "COACH") redirect("/login");

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.userId },
    select: { events: true },
  });

  const { edit } = await searchParams;

  return (
    <div className="py-6 px-4">
      <LogSessionWizard
        apiEndpoint="/api/coach/log-session"
        sessionsPath="/athlete/sessions"
        allowedEvents={coach?.events ?? []}
        editSessionId={edit}
      />
    </div>
  );
}
