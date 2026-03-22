import { redirect } from "next/navigation";
import { getSession, canActAsAthlete } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ProgramDetail } from "./_program-detail";

export default async function SelfProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || !(await canActAsAthlete(session))) redirect("/login");

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!athlete) redirect("/login");

  const { id } = await params;

  const config = await prisma.selfProgramConfig.findUnique({
    where: { id },
    include: {
      trainingProgram: {
        include: {
          phases: {
            orderBy: { phaseOrder: "asc" },
            include: {
              sessions: {
                orderBy: [{ weekNumber: "asc" }, { dayOfWeek: "asc" }],
              },
            },
          },
        },
      },
    },
  });

  if (!config || config.athleteProfileId !== athlete.id) {
    redirect("/athlete/self-program");
  }
  if (!config.trainingProgram) {
    redirect("/athlete/self-program");
  }

  return (
    <ProgramDetail
      config={JSON.parse(JSON.stringify(config))}
      program={JSON.parse(JSON.stringify(config.trainingProgram))}
    />
  );
}
