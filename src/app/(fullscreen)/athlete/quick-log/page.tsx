import { redirect } from "next/navigation";
import { requireAthleteSession } from "@/lib/data/athlete";
import { QuickLogClient } from "./_quick-log-client";

export const metadata = { title: "Quick Log — Podium Throws" };

export default async function QuickLogPage() {
  try {
    const { session } = await requireAthleteSession();
    // userId scopes the IndexedDB draft cache so two users on the same device
    // never read each other's in-flight throw composition.
    return <QuickLogClient userId={session.userId} />;
  } catch {
    redirect("/login");
  }
}
