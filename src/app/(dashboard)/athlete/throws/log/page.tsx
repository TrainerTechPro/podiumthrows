import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import ThrowsLogClient from "./_throws-log-client";

export default async function ThrowsLogPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Resolve athleteId server-side instead of round-tripping /api/auth/me
  // from the client. Falls through with athleteId=null so the client can
  // surface the same "no athlete profile" toast as before.
  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });

  return <ThrowsLogClient userId={session.userId} athleteId={athlete?.id ?? null} />;
}
