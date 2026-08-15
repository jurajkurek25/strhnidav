import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { profiles, lessonVideoKeys } from "@/lib/db/schema";
import { getLessonAccess } from "@/lib/course";

// Serves the raw 16-byte AES-128 key for a lesson's encrypted HLS video.
// This is the one gate in the whole "self-hosted DRM" pipeline: the .m3u8
// playlist and .ts segments are public (useless without the key), but this
// endpoint only ever hands out the key to a logged-in user whose lesson
// gating state is "unlocked" or "completed" right now.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const [profile] = await db.select({ hasFullAccess: profiles.hasFullAccess }).from(profiles).where(eq(profiles.id, userId));

  const { allowed } = await getLessonAccess(userId, lessonId, profile?.hasFullAccess ?? false);
  if (!allowed) return NextResponse.json({ error: "locked" }, { status: 403 });

  const [keyRow] = await db
    .select({ aesKeyBase64: lessonVideoKeys.aesKeyBase64 })
    .from(lessonVideoKeys)
    .where(eq(lessonVideoKeys.lessonId, lessonId));
  if (!keyRow) return NextResponse.json({ error: "not found" }, { status: 404 });

  const keyBytes = Buffer.from(keyRow.aesKeyBase64, "base64");
  return new NextResponse(new Uint8Array(keyBytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
    },
  });
}
