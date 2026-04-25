import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ThrowsBuilderClient from "./_builder-client";

export default async function ThrowsSessionBuilderPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "COACH") redirect("/athlete/dashboard");

  return <ThrowsBuilderClient userId={session.userId} />;
}
