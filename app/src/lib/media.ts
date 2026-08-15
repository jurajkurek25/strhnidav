import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const SIGNED_URL_TTL_SECONDS = 60 * 10; // 10 minutes — short-lived on purpose

export async function signedUrl(
  bucket: string,
  path: string,
  expiresIn: number = SIGNED_URL_TTL_SECONDS
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn, { download: false });
  if (error || !data) return null;
  return data.signedUrl;
}

export async function signedDownloadUrl(
  bucket: string,
  path: string,
  filename: string,
  expiresIn: number = SIGNED_URL_TTL_SECONDS
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn, { download: filename });
  if (error || !data) return null;
  return data.signedUrl;
}

export async function uploadToBucket(
  bucket: string,
  path: string,
  file: Blob,
  contentType: string
): Promise<{ path: string } | { error: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(bucket)
    .upload(path, file, { contentType, upsert: true });
  if (error || !data) return { error: error?.message ?? "Upload zlyhal." };
  return { path: data.path };
}
