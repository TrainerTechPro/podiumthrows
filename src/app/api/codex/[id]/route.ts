import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/* ── DELETE — remove a codex entry ── */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entry = await prisma.codexEntry.findUnique({
      where: { id: params.id },
      select: { userId: true },
    });

    if (!entry) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (entry.userId !== user.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.codexEntry.delete({ where: { id: params.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/codex/:id]", err);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}
