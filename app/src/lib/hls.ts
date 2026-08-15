import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { createAdminClient } from "@/lib/supabase/admin";

const execFileAsync = promisify(execFile);
const HLS_BUCKET = "lesson-videos-hls";
const THUMBNAIL_BUCKET = "lesson-thumbnails";
const SEGMENT_SECONDS = 6;

async function runFfmpeg(args: string[]) {
  if (!ffmpegPath) throw new Error("ffmpeg binary not found (ffmpeg-static).");
  await execFileAsync(ffmpegPath, args, { maxBuffer: 1024 * 1024 * 64 });
}

async function clearExistingHlsFiles(lessonId: string) {
  const admin = createAdminClient();
  const { data: existing } = await admin.storage.from(HLS_BUCKET).list(lessonId);
  if (existing && existing.length > 0) {
    await admin.storage
      .from(HLS_BUCKET)
      .remove(existing.map((f) => `${lessonId}/${f.name}`));
  }
}

/**
 * Segments + AES-128 encrypts a lesson's uploaded video into a private HLS
 * package (self-hosted, no third-party DRM service). The encrypted .ts
 * segments are safe to serve publicly — they're useless without the key —
 * so only the key itself (served from /api/video-key/[lessonId]) is
 * access-controlled behind the normal login + lesson-unlock check.
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

    await clearExistingHlsFiles(lessonId);

    const admin = createAdminClient();
    for (const file of files) {
      const contents = await readFile(path.join(outDir, file));
      const contentType = file.endsWith(".m3u8")
        ? "application/vnd.apple.mpegurl"
        : "video/mp2t";
      const { error } = await admin.storage
        .from(HLS_BUCKET)
        .upload(`${lessonId}/${file}`, contents, { contentType, upsert: true });
      if (error) throw new Error(`upload failed for ${file}: ${error.message}`);
    }

    await admin.from("lesson_video_keys").upsert(
      { lesson_id: lessonId, key_id: keyId, aes_key_base64: key.toString("base64") },
      { onConflict: "lesson_id" }
    );

    const thumbnailReady = await extractThumbnail(inputPath, workDir, lessonId, admin);

    await admin
      .from("lessons")
      .update({
        hls_ready: true,
        hls_segment_count: segmentFiles.length,
        thumbnail_ready: thumbnailReady,
      })
      .eq("id", lessonId);

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
  lessonId: string,
  admin: ReturnType<typeof createAdminClient>
): Promise<boolean> {
  const thumbPath = path.join(workDir, "thumbnail.jpg");
  try {
    await runFfmpeg(["-y", "-ss", "1", "-i", inputPath, "-frames:v", "1", "-q:v", "3", thumbPath]);
    const contents = await readFile(thumbPath);
    const { error } = await admin.storage
      .from(THUMBNAIL_BUCKET)
      .upload(`${lessonId}/thumbnail.jpg`, contents, { contentType: "image/jpeg", upsert: true });
    return !error;
  } catch {
    return false;
  }
}

