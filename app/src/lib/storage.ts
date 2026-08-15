import "server-only";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";

// All uploaded/generated files live on local disk under this root instead of
// a Supabase Storage bucket. Two top-level namespaces:
//   public/  — served with no auth check by src/app/media/[...path]/route.ts
//              (encrypted HLS segments/playlists, thumbnails — safe to be
//              public; the video is useless without its key)
//   private/ — served only after an auth + lesson-access check by
//              src/app/api/files/[bucket]/[...path]/route.ts (documents,
//              audio) or never served back at all (task-uploads, kept only
//              for the record)
const STORAGE_ROOT = process.env.STORAGE_ROOT ?? path.join(process.cwd(), "storage");

/** Strips path separators/traversal so a user-supplied filename can't escape its directory. */
export function sanitizeFilename(name: string): string {
  const base = name.replace(/[/\\]/g, "_").replace(/\.\./g, "_").trim();
  return base.length > 0 ? base : "file";
}

function resolveSafe(relPath: string): string {
  const root = path.resolve(STORAGE_ROOT);
  const full = path.resolve(root, relPath);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error(`refusing to resolve path outside storage root: ${relPath}`);
  }
  return full;
}

export async function writeStorageFile(relPath: string, data: Buffer): Promise<void> {
  const full = resolveSafe(relPath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
}

export async function readStorageFile(relPath: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveSafe(relPath));
  } catch {
    return null;
  }
}

export async function deleteStorageDir(relPath: string): Promise<void> {
  await rm(resolveSafe(relPath), { recursive: true, force: true }).catch(() => {});
}

export function contentTypeFor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "m3u8":
      return "application/vnd.apple.mpegurl";
    case "ts":
      return "video/mp2t";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "wav":
      return "audio/wav";
    default:
      return "application/octet-stream";
  }
}
