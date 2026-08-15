// Pure URL builders — safe to import from client components (unlike the
// rest of src/lib/hls.ts, which needs Node/ffmpeg and is marked
// "server-only"). Only touches NEXT_PUBLIC_* env vars.

export function publicHlsPlaylistUrl(lessonId: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${base}/storage/v1/object/public/lesson-videos-hls/${lessonId}/playlist.m3u8`;
}

export function publicThumbnailUrl(lessonId: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${base}/storage/v1/object/public/lesson-thumbnails/${lessonId}/thumbnail.jpg`;
}
