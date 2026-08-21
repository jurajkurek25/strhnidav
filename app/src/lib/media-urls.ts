// Pure URL builders — safe to import from client components. Served by
// src/app/media/[...path]/route.ts (public, no auth check — encrypted HLS
// segments are useless without their key, and thumbnails are meant to be
// visible on the dashboard/admin grids regardless of lock state).

export function publicHlsPlaylistUrl(lessonId: string): string {
  return `/media/hls/${lessonId}/playlist.m3u8`;
}

export function publicThumbnailUrl(lessonId: string): string {
  return `/media/thumbnails/${lessonId}/thumbnail.jpg`;
}

// filePath already includes the "community-posts/…" prefix (see
// communityPostAttachments.filePath) — this just adds the /media/ route.
export function publicCommunityAttachmentUrl(filePath: string): string {
  return `/media/${filePath}`;
}
