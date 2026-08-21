import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getLessonAccess } from "@/lib/course";
import { readStorageFile, contentTypeFor } from "@/lib/storage";

const BUCKETS = new Set(["documents", "audio"]);

// Documents/audio are gated exactly like the lesson page itself: logged in
// + that lesson is actually unlocked for this user right now — never just
// "the link was in the HTML at some point".
export async function GET(
  request: Request,
  { params }: { params: Promise<{ bucket: string; path: string[] }> }
) {
  const { bucket, path: segments } = await params;
  if (!BUCKETS.has(bucket)) return new NextResponse("not found", { status: 404 });

  const relPath = segments.join("/");
  if (relPath.includes("..") || segments.length === 0) {
    return new NextResponse("not found", { status: 404 });
  }
  const lessonId = segments[0];

  const session = await auth();
  if (!session?.user?.id) return new NextResponse("unauthorized", { status: 401 });

  const profile = await db.query.profiles.findFirst({ where: eq(profiles.id, session.user.id) });
  if (!profile) return new NextResponse("unauthorized", { status: 401 });

  const { allowed } = await getLessonAccess(profile.id, lessonId, profile.hasFullAccess);
  if (!allowed) return new NextResponse("forbidden", { status: 403 });

  const data = await readStorageFile(`private/${bucket}/${relPath}`);
  if (!data) return new NextResponse("not found", { status: 404 });

  const downloadName = new URL(request.url).searchParams.get("download");
  const headers: Record<string, string> = {
    "Content-Type": contentTypeFor(relPath),
    "Cache-Control": "private, max-age=0, no-cache",
  };
  if (downloadName) {
    headers["Content-Disposition"] = `attachment; filename="${encodeURIComponent(downloadName)}"`;
  }

  return new NextResponse(new Uint8Array(data), { headers });
}
