import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLessonAccess } from "@/lib/course";

// Serves the raw 16-byte AES-128 key for a lesson's encrypted HLS video.
// This is the one gate in the whole "self-hosted DRM" pipeline: the .m3u8
// playlist and .ts segments are public (useless without the key), but this
// endpoint only ever hands out the key to a logged-in user whose lesson
// gating state is "unlocked" or "completed" right now.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("has_full_access")
    .eq("id", user.id)
    .single();

  const { allowed } = await getLessonAccess(
    supabase,
    user.id,
    lessonId,
    profile?.has_full_access ?? false
  );
  if (!allowed) return NextResponse.json({ error: "locked" }, { status: 403 });

  const admin = createAdminClient();
  const { data: keyRow } = await admin
    .from("lesson_video_keys")
    .select("aes_key_base64")
    .eq("lesson_id", lessonId)
    .single();
  if (!keyRow) return NextResponse.json({ error: "not found" }, { status: 404 });

  const keyBytes = Buffer.from(keyRow.aes_key_base64, "base64");
  return new NextResponse(new Uint8Array(keyBytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
    },
  });
}
