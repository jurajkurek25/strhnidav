import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { getLessonAccess } from "@/lib/course";
import { signCastToken } from "@/lib/cast-token";

// Cookie-authenticated, called from the page itself right before opening
// the Chromecast device picker — mints a short-lived token and returns the
// absolute manifest URL the *receiver device* (not this browser) will fetch
// independently. See src/lib/cast-token.ts for why a token is needed here
// at all instead of just reusing the session cookie.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const [profile] = await db
    .select({ hasFullAccess: profiles.hasFullAccess })
    .from(profiles)
    .where(eq(profiles.id, userId));

  const { allowed } = await getLessonAccess(userId, lessonId, profile?.hasFullAccess ?? false);
  if (!allowed) return NextResponse.json({ error: "locked" }, { status: 403 });

  const token = signCastToken(lessonId, userId);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  const url = `${siteUrl}/media/hls/${lessonId}/cast.m3u8?token=${encodeURIComponent(token)}`;

  return NextResponse.json({ url });
}
