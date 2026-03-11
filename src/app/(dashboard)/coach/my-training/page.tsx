import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { TabNav, type TabId } from "./_tab-nav";
import { SessionsTab } from "./_sessions-tab";
import { InsightsTab } from "./_insights-tab";
import { RecordsTab } from "./_records-tab";
import { TypingTab } from "./_typing-tab";

export default async function CoachMyTrainingPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const session = await getSession();
  if (!session || session.role !== "COACH") redirect("/login");

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true, preferences: true },
  });
  if (!coach) redirect("/login");

  const prefs = JSON.parse(coach.preferences || "{}");
  const competitiveMode = prefs.myTraining?.mode === "competitive";
  const tab = (searchParams.tab as TabId) || "sessions";

  // Fetch data based on active tab to avoid unnecessary queries
  let sessions: unknown[] = [];
  let prs: unknown[] = [];
  let testingRecords: unknown[] = [];
  let typingData: unknown = null;
  let sessionCount = 0;

  if (tab === "sessions" || tab === "records") {
    const [sessionsResult, prsResult] = await Promise.all([
      tab === "sessions"
        ? prisma.coachThrowsSession.findMany({
            where: { coachId: coach.id },
            orderBy: { date: "desc" },
            take: 100,
            include: { drillLogs: { orderBy: { createdAt: "asc" } } },
          })
        : Promise.resolve([]),
      prisma.coachPR.findMany({
        where: { coachId: coach.id },
        orderBy: [{ event: "asc" }, { distance: "desc" }],
      }),
    ]);
    sessions = sessionsResult;
    prs = prsResult;
    sessionCount = tab === "sessions" ? sessionsResult.length : 0;

    if (tab === "records") {
      testingRecords = await prisma.coachTestingRecord.findMany({
        where: { coachId: coach.id },
        orderBy: { testDate: "desc" },
      });
    }
  }

  if (tab === "sessions" && sessionCount === 0) {
    sessionCount = await prisma.coachThrowsSession.count({
      where: { coachId: coach.id },
    });
  }

  if (tab === "typing") {
    typingData = await prisma.coachTyping.findUnique({
      where: { coachId: coach.id },
    });
  }

  // For the header count, always get total
  if (tab !== "sessions") {
    sessionCount = await prisma.coachThrowsSession.count({
      where: { coachId: coach.id },
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            My Training
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {sessionCount} session{sessionCount !== 1 ? "s" : ""} logged
          </p>
        </div>
        <Link href="/coach/log-session" className="btn-primary whitespace-nowrap">
          + Log Session
        </Link>
      </div>

      <Suspense fallback={null}>
        <TabNav />
      </Suspense>

      {tab === "sessions" && (
        <SessionsTab
          sessions={JSON.parse(JSON.stringify(sessions))}
          prs={JSON.parse(JSON.stringify(prs))}
          competitiveMode={competitiveMode}
        />
      )}

      {tab === "insights" && <InsightsTab />}

      {tab === "records" && (
        <RecordsTab
          prs={JSON.parse(JSON.stringify(prs))}
          testingRecords={JSON.parse(JSON.stringify(testingRecords))}
        />
      )}

      {tab === "typing" && (
        <TypingTab
          typingData={typingData ? JSON.parse(JSON.stringify(typingData)) : null}
        />
      )}
    </div>
  );
}
