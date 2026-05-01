import { redirect } from "next/navigation";
import { getSession, canActAsAthlete } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { HistoryClient } from "./_history-client";
import { ThrowsChipNav } from "../_chip-nav";

export const metadata = {
  title: "Throws History",
};

export default async function ThrowsHistoryPage() {
  const session = await getSession();
  if (!session || !(await canActAsAthlete(session))) redirect("/login");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!athlete) redirect("/login");

  return (
    <div className="max-w-3xl mx-auto pb-12 space-y-5">
      <ThrowsChipNav />
      <HistoryClient athleteId={athlete.id} />
    </div>
  );
}
