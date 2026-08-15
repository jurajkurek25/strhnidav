import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({
  lessonId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .single();

  const { data, error } = await supabase
    .from("comments")
    .insert({ lesson_id: parsed.data.lessonId, user_id: user.id, body: parsed.data.body })
    .select("id, body, created_at")
    .single();

  if (error || !data) return NextResponse.json({ error: "insert failed" }, { status: 500 });

  return NextResponse.json({
    comment: {
      id: data.id,
      body: data.body,
      created_at: data.created_at,
      author_name: profile?.full_name ?? null,
      author_avatar: profile?.avatar_url ?? null,
      is_own: true,
    },
  });
}
