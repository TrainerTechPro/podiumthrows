import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { FixThrowHistoryClient } from "./_fix-throws-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fix throw history — Podium Throws" };

/**
 * /athlete/settings/fix-throw-history
 *
 * Tony's specific cleanup workflow. Lists every (event, weightKg) group
 * of un-assigned throws, with a one-click Confirm action when the catalog
 * matcher returns an exact/tolerated match, and a Pick fallback opening
 * the implement picker for ambiguous/none cases.
 */
export default async function FixThrowHistoryPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true, firstName: true },
  });
  if (!athlete) redirect("/login");

  return <FixThrowHistoryClient athleteId={athlete.id} />;
}
