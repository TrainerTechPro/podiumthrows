import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LogSessionWizard } from "../../athlete/log-session/_log-session-wizard";

export default async function CoachLogSessionPage() {
  const session = await getSession();
  if (!session || session.role !== "COACH") redirect("/login");

  return (
    <div className="py-6 px-4">
      <LogSessionWizard
        apiEndpoint="/api/coach/log-session"
        sessionsPath="/coach/my-training"
      />
    </div>
  );
}
