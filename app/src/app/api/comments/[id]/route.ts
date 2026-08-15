import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  // RLS (comments_delete_own) already restricts this to the caller's own rows.
  await supabase.from("comments").delete().eq("id", id).eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
