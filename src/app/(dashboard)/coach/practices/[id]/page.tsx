import { redirect, notFound } from "next/navigation";
import { requireCoachSession } from "@/lib/data/coach";
import { getPracticeDetail } from "@/lib/data/practices";
import { AttendanceClient } from "./_attendance-client";

export const metadata = { title: "Take Attendance — Podium Throws" };

export default async function PracticeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let result;
  try {
    result = await requireCoachSession();
  } catch {
    redirect("/login");
  }

  const { id } = await params;
  const detail = await getPracticeDetail(id, result.coach.id);
  if (!detail) notFound();

  return <AttendanceClient practiceId={id} initialDetail={detail} />;
}
