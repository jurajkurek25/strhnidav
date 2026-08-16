import { NextResponse } from "next/server";
import { readStorageFile, contentTypeFor } from "@/lib/storage";
import { verifyCastToken } from "@/lib/cast-token";

const CAST_PLAYLIST_RE = /^hls\/([^/]+)\/cast\.m3u8$/;

// Public, unauthenticated file serving — only ever used for the encrypted
// HLS video segments/playlist (useless without the key served by
// /api/video-key/[lessonId]) and lesson thumbnails. Everything that
// actually needs an access check lives behind /api/files instead.
//
// One exception: hls/[lessonId]/cast.m3u8 isn't a real file on disk. It's a
// virtual, ?token=-gated view of the real playlist, generated on the fly
// with its #EXT-X-KEY URI rewritten to carry that same token — the copy a
// Chromecast receiver fetches when a lesson is cast (see
// src/app/api/cast/[lessonId]/route.ts). Serving it under hls/[lessonId]/
// rather than a separate path means the playlist's existing relative
// segment_XXX.ts references keep resolving correctly with no rewriting.
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const relPath = segments.join("/");
  if (relPath.includes("..")) {
    return new NextResponse("not found", { status: 404 });
  }

  const castMatch = relPath.match(CAST_PLAYLIST_RE);
  if (castMatch) {
    const lessonId = castMatch[1];
    const token = new URL(request.url).searchParams.get("token");
    if (!token || !verifyCastToken(token, lessonId)) {
      return new NextResponse("unauthorized", { status: 401 });
    }

    const playlist = await readStorageFile(`public/hls/${lessonId}/playlist.m3u8`);
    if (!playlist) return new NextResponse("not found", { status: 404 });

    const rewritten = playlist
      .toString("utf8")
      .replace(/(#EXT-X-KEY:[^\n]*URI=")([^"]+)(")/, (_m, pre, uri, post) => {
        const separator = uri.includes("?") ? "&" : "?";
        return `${pre}${uri}${separator}token=${encodeURIComponent(token)}${post}`;
      });

    return new NextResponse(rewritten, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-store",
      },
    });
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
