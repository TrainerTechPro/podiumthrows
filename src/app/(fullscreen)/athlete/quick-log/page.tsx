import { redirect } from "next/navigation";
import { requireAthleteSession } from "@/lib/data/athlete";
import { QuickLogClient } from "./_quick-log-client";

export const metadata = { title: "Quick Log — Podium Throws" };

export default async function QuickLogPage() {
  try {
    await requireAthleteSession();
  } catch {
    redirect("/login");
  }
  return <QuickLogClient />;
}
