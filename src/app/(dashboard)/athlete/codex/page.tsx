import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CodexView } from "@/components/codex/CodexView";

export default async function AthleteCodexPage() {
  const session = await getSession();
  if (!session || (session.role !== "ATHLETE" && session.role !== "COACH")) redirect("/login");

  return <CodexView />;
}
