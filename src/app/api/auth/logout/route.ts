import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookie, clearCsrfCookie, getSession } from "@/lib/auth";
import { logAudit, auditRequestInfo } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const session = await getSession();

  const response = NextResponse.json({ success: true });
  response.headers.append("Set-Cookie", clearAuthCookie());
  response.headers.append("Set-Cookie", clearCsrfCookie());

  if (session) {
    void logAudit({
      userId: session.userId,
      action: "LOGOUT",
      ...auditRequestInfo(request),
    });
  }

  return response;
}
