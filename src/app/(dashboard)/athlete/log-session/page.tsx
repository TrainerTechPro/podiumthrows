import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LogSessionWizard } from "./_log-session-wizard";

export default async function AthleteLogSessionPage() {
  const session = await getSession();
  if (!session || session.role !== "ATHLETE") redirect("/login");

  return (
    <div className="py-6 px-4">
      <LogSessionWizard />
    </div>
  );
}
