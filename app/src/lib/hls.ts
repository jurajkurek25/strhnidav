import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessons, lessonVideoKeys } from "@/lib/db/schema";
import { writeStorageFile, deleteStorageDir } from "@/lib/storage";

const execFileAsync = promisify(execFile);
const SEGMENT_SECONDS = 6;

async function runFfmpeg(args: string[]) {
  if (!ffmpegPath) throw new Error("ffmpeg binary not found (ffmpeg-static).");
  await execFileAsync(ffmpegPath, args, { maxBuffer: 1024 * 1024 * 64 });
}

/**
 * Segments + AES-128 encrypts a lesson's uploaded video into a private HLS
 * package (self-hosted, no third-party DRM service). The encrypted .ts
 * segments are written to local disk as public static files — they're safe
 * to serve without auth, since they're useless without the key — so only
 * the key itself (served from /api/video-key/[lessonId]) is access-controlled
 * behind the normal login + lesson-unlock check.
 */
export async function packageLessonVideoAsEncryptedHls(
  lessonId: string,
  inputBuffer: Buffer,
  inputExt: string,
  siteUrl: string
): Promise<{ segmentCount: number }> {
  const workDir = await mkdtemp(path.join(tmpdir(), `hls-${lessonId}-`));
  const inputPath = path.join(workDir, `input.${inputExt}`);
  const outDir = path.join(workDir, "out");
  const keyPath = path.join(workDir, "key.bin");
  const keyInfoPath = path.join(workDir, "keyinfo.txt");

  try {
    await mkdir(outDir, { recursive: true });
    await writeFile(inputPath, inputBuffer);

    const key = randomBytes(16);
    const keyId = randomUUID();
    await writeFile(keyPath, key);

    // ffmpeg's HLS-AES128 muxer only supports one static IV for the whole
    // file (there's no per-segment IV in the 3-line keyinfo format) — so we
    // still explicitly randomize it per lesson rather than leaving it at
    // ffmpeg's zero default, since a fresh random key *and* IV per lesson
    // is what keeps that reuse from being a real weakness.
    const iv = randomBytes(16).toString("hex");
    const keyUri = `${siteUrl}/api/video-key/${lessonId}`;
    await writeFile(keyInfoPath, `${keyUri}\n${keyPath}\n${iv}\n`);

    const playlistPath = path.join(outDir, "playlist.m3u8");
    const commonArgs = [
      "-y",
      "-i",
      inputPath,
      "-start_number",
      "0",
      "-hls_time",
      String(SEGMENT_SECONDS),
      "-hls_list_size",
      "0",
      "-hls_key_info_file",
      keyInfoPath,
      "-hls_playlist_type",
      "vod",
      "-hls_segment_filename",
      path.join(outDir, "segment_%03d.ts"),
      playlistPath,
    ];

    try {
      // Fast path: remux without re-encoding (works when the source is
      // already H.264/AAC, which covers most screen/webcam recordings).
      await runFfmpeg(["-c", "copy", ...commonArgs]);
    } catch {
      // Fallback: re-encode for sources -c copy can't segment cleanly.
      await runFfmpeg(["-c:v", "libx264", "-c:a", "aac", ...commonArgs]);
    }

    const files = (await readdir(outDir)).sort();
    const segmentFiles = files.filter((f) => f.endsWith(".ts"));
    if (segmentFiles.length === 0) throw new Error("ffmpeg produced no segments");

    await deleteStorageDir(`public/hls/${lessonId}`);
    for (const file of files) {
      const contents = await readFile(path.join(outDir, file));
      await writeStorageFile(`public/hls/${lessonId}/${file}`, contents);
    }

    await db
      .insert(lessonVideoKeys)
      .values({ lessonId, keyId, aesKeyBase64: key.toString("base64") })
      .onConflictDoUpdate({
        target: lessonVideoKeys.lessonId,
        set: { keyId, aesKeyBase64: key.toString("base64") },
      });

    const thumbnailReady = await extractThumbnail(inputPath, workDir, lessonId);

    await db
      .update(lessons)
      .set({
        hlsReady: true,
        hlsSegmentCount: segmentFiles.length,
        thumbnailReady,
      })
      .where(eq(lessons.id, lessonId));

    return { segmentCount: segmentFiles.length };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

/** Grabs a single frame ~1s in as the grid/dashboard thumbnail. Best-effort —
 * a lesson without a thumbnail just falls back to the decorative gradient
 * card, so failures here shouldn't fail the whole upload. */
async function extractThumbnail(
  inputPath: string,
  workDir: string,
  lessonId: string
): Promise<boolean> {
  const thumbPath = path.join(workDir, "thumbnail.jpg");
  try {
    await runFfmpeg(["-y", "-ss", "1", "-i", inputPath, "-frames:v", "1", "-q:v", "3", thumbPath]);
    const contents = await readFile(thumbPath);
    await writeStorageFile(`public/thumbnails/${lessonId}/thumbnail.jpg`, contents);
    return true;
  } catch {
    return false;
  }
}
