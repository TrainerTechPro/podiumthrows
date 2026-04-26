"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "coach_mobile_view";
const ONE_YEAR = 365 * 24 * 60 * 60;

export async function setCoachMobileView(view: "sideline" | "full") {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, view, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  redirect(view === "sideline" ? "/coach/sideline" : "/coach/dashboard");
}
