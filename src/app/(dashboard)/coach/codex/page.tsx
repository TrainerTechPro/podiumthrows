import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CodexView } from "./_codex-client";

export default async function CoachCodexPage() {
  const session = await getSession();
  if (!session || session.role !== "COACH") redirect("/login");

  return <CodexView />;
}
