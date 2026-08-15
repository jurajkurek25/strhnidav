import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { comments } from "@/lib/db/schema";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  // Explicit own-row check — there's no RLS to fall back on here anymore.
  await db.delete(comments).where(and(eq(comments.id, id), eq(comments.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}
