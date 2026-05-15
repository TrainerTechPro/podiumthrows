import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { computeSessionRecap } from "@/lib/data/session-recap";
import { RecapClient } from "./_recap-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Session Recap — Podium Throws" };

export default async function AthleteSessionRecapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ATHLETE") redirect("/login");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true, firstName: true },
  });
  if (!athlete) redirect("/login");

  const recap = await computeSessionRecap(athlete.id, id);
  if (!recap) notFound();

  return <RecapClient recap={recap} athleteFirstName={athlete.firstName} />;
}
