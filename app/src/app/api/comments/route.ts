import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { comments, profiles } from "@/lib/db/schema";

const Body = z.object({
  lessonId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const [profile] = await db
    .select({ fullName: profiles.fullName, avatarUrl: profiles.avatarUrl })
    .from(profiles)
    .where(eq(profiles.id, userId));

  const [created] = await db
    .insert(comments)
    .values({ lessonId: parsed.data.lessonId, userId, body: parsed.data.body })
    .returning({ id: comments.id, body: comments.body, createdAt: comments.createdAt });

  if (!created) return NextResponse.json({ error: "insert failed" }, { status: 500 });

  return NextResponse.json({
    comment: {
      id: created.id,
      body: created.body,
      created_at: created.createdAt.toISOString(),
      author_name: profile?.fullName ?? null,
      author_avatar: profile?.avatarUrl ?? null,
      is_own: true,
    },
  });
}
