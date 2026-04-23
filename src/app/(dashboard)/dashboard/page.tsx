// Single source of truth for role-agnostic post-login routing. Callers that
// don't know the role (password reset, email verify, magic links, bookmarks)
// should send users here.

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardEntryPage() {
  const payload = await getSession();
  if (!payload) redirect("/login?redirect=/dashboard");

  const cookieStore = await cookies();
  const activeMode = cookieStore.get("active-mode")?.value;

  if (payload.role === "COACH" && activeMode === "TRAINING") {
    redirect("/athlete/dashboard");
  }

  if (payload.role === "COACH") {
    redirect("/coach/dashboard");
  }

  if (payload.role === "ATHLETE") {
    redirect("/athlete/dashboard");
  }

  if (payload.isAdmin) {
    redirect("/coach/dashboard");
  }

  redirect("/login?redirect=/dashboard");
}
