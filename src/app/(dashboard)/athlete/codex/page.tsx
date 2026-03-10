import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CodexView } from "../../coach/codex/_codex-client";

export default async function AthleteCodexPage() {
  const session = await getSession();
  if (!session || session.role !== "ATHLETE") redirect("/login");

  return <CodexView />;
}
