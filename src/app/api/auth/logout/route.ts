import { NextResponse } from "next/server";
import { clearAuthCookie, clearCsrfCookie } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.headers.append("Set-Cookie", clearAuthCookie());
  response.headers.append("Set-Cookie", clearCsrfCookie());
  return response;
}
