import "server-only";
import { writeStorageFile, sanitizeFilename } from "@/lib/storage";

/** URL for a private document/audio download, gated by src/app/api/files/[bucket]/[...path]/route.ts. */
export function privateFileUrl(
  bucket: "documents" | "audio",
  filePath: string,
  downloadFilename?: string
): string {
  const q = downloadFilename ? `?download=${encodeURIComponent(downloadFilename)}` : "";
  return `/api/files/${bucket}/${filePath}${q}`;
}

/**
 * Writes an uploaded file to local disk under STORAGE_ROOT/private/<bucket>.
 * `relPath` should already be namespaced by lesson/user id, e.g.
 * `${lessonId}/${Date.now()}-${sanitizeFilename(file.name)}`.
 */
export async function uploadPrivateFile(
  bucket: "documents" | "audio" | "task-uploads",
  relPath: string,
  file: File
): Promise<{ path: string } | { error: string }> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeStorageFile(`private/${bucket}/${relPath}`, buffer);
    return { path: relPath };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload zlyhal." };
  }
}

export { sanitizeFilename };
