import { NextResponse } from "next/server";
import { readStorageFile, contentTypeFor } from "@/lib/storage";

// Public, unauthenticated file serving — only ever used for the encrypted
// HLS video segments/playlist (useless without the key served by
// /api/video-key/[lessonId]) and lesson thumbnails. Everything that
// actually needs an access check lives behind /api/files instead.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const relPath = segments.join("/");
  if (relPath.includes("..")) {
    return new NextResponse("not found", { status: 404 });
  }

  const data = await readStorageFile(`public/${relPath}`);
  if (!data) return new NextResponse("not found", { status: 404 });

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentTypeFor(relPath),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
