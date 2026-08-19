"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { asc, count, eq, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  sections,
  lessons,
  actionSteps,
  lessonDocuments,
  lessonAudio,
  profiles,
  freeAccessGrants,
  courseSettings,
} from "@/lib/db/schema";
import { uploadPrivateFile } from "@/lib/media";
import { writeStorageFile, deleteStorageDir, sanitizeFilename } from "@/lib/storage";
import { packageLessonVideoAsEncryptedHls } from "@/lib/hls";
import { slugify } from "@/lib/slug";
import type { TaskType, LessonAudience } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// sections
// ---------------------------------------------------------------------------

// Appends -2, -3, ... until the slug is free. excludeId lets an existing
// section keep its own current slug when it isn't actually changing.
async function uniqueSlug(base: string, excludeId?: string): Promise<string | null> {
  const root = slugify(base);
  if (!root) return null;

  for (let suffix = 0; suffix < 50; suffix++) {
    const candidate = suffix === 0 ? root : `${root}-${suffix + 1}`;
    const [existing] = await db
      .select({ id: sections.id })
      .from(sections)
      .where(eq(sections.slug, candidate));
    if (!existing || existing.id === excludeId) return candidate;
  }
  return null;
}

export async function createSection(formData: FormData) {
  await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!title) return;

  const [{ value: sectionCount }] = await db.select({ value: count() }).from(sections);
  const slug = await uniqueSlug(title);

  await db.insert(sections).values({ title, description, orderIndex: sectionCount, slug });

  revalidatePath("/admin/sections");
}

// Title, description, price and the /buy/[slug] link, all edited inline in
// the admin sections list. A slug that's already taken by another section is
// silently ignored (everything else still saves) rather than throwing — this
// is a lightweight inline form, not a full page, so there's nowhere good to
// surface a validation error; the admin sees the old slug is still there and
// can pick another.
export async function updateSectionMeta(id: string, formData: FormData) {
  await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const priceEur = Number(formData.get("price_eur"));
  const rawSlug = String(formData.get("slug") ?? "").trim();

  const patch: { title?: string; description?: string | null; priceCents?: number; slug?: string | null } = {};

  if (title) {
    patch.title = title;
  }
  patch.description = description;

  if (Number.isFinite(priceEur) && priceEur >= 0) {
    patch.priceCents = Math.round(priceEur * 100);
  }

  if (rawSlug === "") {
    patch.slug = null;
  } else {
    const normalized = slugify(rawSlug);
    const [existing] = await db
      .select({ id: sections.id })
      .from(sections)
      .where(eq(sections.slug, normalized));
    if (normalized && (!existing || existing.id === id)) {
      patch.slug = normalized;
    }
  }

  if (Object.keys(patch).length > 0) {
    await db.update(sections).set(patch).where(eq(sections.id, id));
  }

  revalidatePath("/admin/sections");
  revalidatePath("/dashboard");
}

// Full-course price and monthly subscription price — independent fields
// (deliberately not derived from one another, see the comment on
// courseSettings in src/lib/db/schema.ts). The table always has exactly
// one row (id = true), so this is always an update, never an insert; the
// row is seeded by migration 0008_course_settings.sql.
export async function updateCourseSettings(formData: FormData) {
  await requireAdmin();

  const priceEur = Number(formData.get("price_eur"));
  const subscriptionPriceEur = Number(formData.get("subscription_price_eur"));

  const patch: { priceCents?: number; subscriptionPriceCents?: number } = {};
  if (Number.isFinite(priceEur) && priceEur >= 0) {
    patch.priceCents = Math.round(priceEur * 100);
  }
  if (Number.isFinite(subscriptionPriceEur) && subscriptionPriceEur >= 0) {
    patch.subscriptionPriceCents = Math.round(subscriptionPriceEur * 100);
  }
  if (Object.keys(patch).length === 0) return;

  await db
    .update(courseSettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(courseSettings.id, true));

  revalidatePath("/admin/sections");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/unlock");
}

export async function deleteSection(id: string) {
  await requireAdmin();
  await db.delete(sections).where(eq(sections.id, id));
  revalidatePath("/admin/sections");
}

export async function reorderSections(orderedIds: string[]) {
  await requireAdmin();
  await Promise.all(
    orderedIds.map((id, i) => db.update(sections).set({ orderIndex: i }).where(eq(sections.id, id)))
  );
  revalidatePath("/admin/sections");
}

// ---------------------------------------------------------------------------
// lessons
// ---------------------------------------------------------------------------
export async function saveLesson(formData: FormData) {
  await requireAdmin();

  const lessonId = String(formData.get("lesson_id") ?? "").trim() || null;
  const requestedDayNumber = Number(formData.get("day_number"));
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const sectionId = String(formData.get("section_id") ?? "").trim() || null;
  const taskType = String(formData.get("task_type") ?? "text") as TaskType;
  const taskPrompt = String(formData.get("task_prompt") ?? "").trim() || null;
  const isFree = formData.get("is_free") === "on";
  const rawAudience = String(formData.get("audience") ?? "all");
  const audience: LessonAudience = rawAudience === "men" || rawAudience === "women" ? rawAudience : "all";

  if (!title || !Number.isFinite(requestedDayNumber)) {
    throw new Error("Deň a názov lekcie sú povinné.");
  }

  const lessonPatch = {
    title,
    description,
    sectionId,
    taskType,
    taskPrompt,
    isFree,
    audience,
    updatedAt: new Date(),
  };

  let id = lessonId;
  if (id) {
    await db.update(lessons).set(lessonPatch).where(eq(lessons.id, id));
  } else {
    // day_number is UNIQUE — a brand-new lesson is inserted past the
    // current end of the sequence first (always a free number), then
    // moved to whatever position was actually requested below, exactly
    // like repositioning an existing lesson.
    const [{ value: lessonCount }] = await db.select({ value: count() }).from(lessons);
    const [created] = await db
      .insert(lessons)
      .values({ ...lessonPatch, dayNumber: lessonCount + 1 })
      .returning({ id: lessons.id });
    if (!created) throw new Error("Nepodarilo sa vytvoriť lekciu.");
    id = created.id;
  }

  // Move this lesson to the requested day number, renumbering everything
  // else around it. day_number is UNIQUE, so writing the requested number
  // directly (as the old code did) throws a Postgres unique-violation the
  // moment it's already held by another lesson — e.g. editing lesson 3 to
  // day 8 when a lesson 8 already exists. Instead this is treated exactly
  // like a drag-and-drop reorder to that position (see renumberLessons).
  const allLessons = await db.select({ id: lessons.id }).from(lessons).orderBy(asc(lessons.dayNumber));
  const otherIds = allLessons.map((l) => l.id).filter((otherId) => otherId !== id);
  const targetIndex = Math.min(Math.max(Math.round(requestedDayNumber) - 1, 0), otherIds.length);
  const orderedIds = [...otherIds.slice(0, targetIndex), id, ...otherIds.slice(targetIndex)];
  await renumberLessons(orderedIds);

  // Optional new video file replaces the existing one — packaged into
  // AES-128 encrypted HLS (see src/lib/hls.ts) rather than stored raw. This
  // also auto-extracts a thumbnail frame, which a manual upload below (if
  // provided in the same submission) then overrides.
  const video = formData.get("video");
  if (video instanceof File && video.size > 0) {
    const ext = video.name.split(".").pop() || "mp4";
    const buffer = Buffer.from(await video.arrayBuffer());
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
    await packageLessonVideoAsEncryptedHls(id, buffer, ext, siteUrl);
  }

  // Optional manual thumbnail — wins over the auto-extracted video frame,
  // whether uploaded now or later. Public (same as the auto-generated one),
  // served by src/app/media/[...path]/route.ts.
  const thumbnail = formData.get("thumbnail");
  if (thumbnail instanceof File && thumbnail.size > 0) {
    const buffer = Buffer.from(await thumbnail.arrayBuffer());
    await writeStorageFile(`public/thumbnails/${id}/thumbnail.jpg`, buffer);
    await db.update(lessons).set({ thumbnailReady: true }).where(eq(lessons.id, id));
  }

  // Action steps: parallel arrays of (possibly empty) ids and bodies from
  // the dynamic editor. Empty id + non-empty body = new row. Existing id +
  // empty body = delete. Existing id + non-empty body = update in place so
  // we never cascade-delete a user's checklist progress on unrelated edits.
  const ids = formData.getAll("action_step_ids[]").map(String);
  const bodies = formData.getAll("action_steps[]").map(String);
  const existingSteps = await db
    .select({ id: actionSteps.id })
    .from(actionSteps)
    .where(eq(actionSteps.lessonId, id));
  const existingIds = new Set(existingSteps.map((s) => s.id));
  const keptIds = new Set<string>();

  let orderIndex = 0;
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i].trim();
    const stepId = ids[i];
    if (stepId && existingIds.has(stepId)) {
      if (body) {
        await db.update(actionSteps).set({ body, orderIndex: orderIndex++ }).where(eq(actionSteps.id, stepId));
        keptIds.add(stepId);
      }
    } else if (body) {
      await db.insert(actionSteps).values({ lessonId: id, body, orderIndex: orderIndex++ });
    }
  }
  const toDelete = [...existingIds].filter((existingId) => !keptIds.has(existingId));
  if (toDelete.length > 0) {
    await db.delete(actionSteps).where(inArray(actionSteps.id, toDelete));
  }

  // New documents / audio (appended, existing ones are untouched here —
  // removed individually via deleteDocument/deleteAudio).
  const documents = formData.getAll("new_documents").filter((f): f is File => f instanceof File && f.size > 0);
  const [{ value: docCount }] = await db
    .select({ value: count() })
    .from(lessonDocuments)
    .where(eq(lessonDocuments.lessonId, id));
  for (let i = 0; i < documents.length; i++) {
    const file = documents[i];
    const relPath = `${id}/${Date.now()}-${sanitizeFilename(file.name)}`;
    const result = await uploadPrivateFile("documents", relPath, file);
    if ("path" in result) {
      await db.insert(lessonDocuments).values({
        lessonId: id,
        title: file.name,
        filePath: result.path,
        orderIndex: docCount + i,
      });
    }
  }

  const audioFiles = formData.getAll("new_audio").filter((f): f is File => f instanceof File && f.size > 0);
  const [{ value: audioCount }] = await db
    .select({ value: count() })
    .from(lessonAudio)
    .where(eq(lessonAudio.lessonId, id));
  for (let i = 0; i < audioFiles.length; i++) {
    const file = audioFiles[i];
    const relPath = `${id}/${Date.now()}-${sanitizeFilename(file.name)}`;
    const result = await uploadPrivateFile("audio", relPath, file);
    if ("path" in result) {
      await db.insert(lessonAudio).values({
        lessonId: id,
        title: file.name,
        filePath: result.path,
        orderIndex: audioCount + i,
      });
    }
  }

  revalidatePath("/admin/lessons");
  revalidatePath(`/admin/lessons/${id}`);
  revalidatePath("/dashboard");
  redirect("/admin/lessons");
}

export async function deleteLesson(id: string) {
  await requireAdmin();
  await db.delete(lessons).where(eq(lessons.id, id));
  await Promise.all([
    deleteStorageDir(`public/hls/${id}`),
    deleteStorageDir(`public/thumbnails/${id}`),
    deleteStorageDir(`private/documents/${id}`),
    deleteStorageDir(`private/audio/${id}`),
  ]);
  revalidatePath("/admin/lessons");
}

/**
 * Renumbers day_number to match the given order. Two-phase because
 * day_number is UNIQUE — writing final values directly could collide with
 * another lesson's current number mid-sequence. Negative placeholders can
 * never collide with a real (positive) day_number, so phase one always
 * clears the table before phase two assigns the real 1..N numbers.
 * Renumbering is safe for gating: progress is keyed by lesson_id, and
 * day_number is only ever used as a sort/display key (src/lib/gating.ts).
 */
async function renumberLessons(orderedIds: string[]) {
  await Promise.all(
    orderedIds.map((id, i) => db.update(lessons).set({ dayNumber: -(i + 1) }).where(eq(lessons.id, id)))
  );
  await Promise.all(
    orderedIds.map((id, i) => db.update(lessons).set({ dayNumber: i + 1 }).where(eq(lessons.id, id)))
  );
}

// Drag-and-drop reordering from the admin lessons grid.
export async function reorderLessons(orderedIds: string[]) {
  await requireAdmin();
  await renumberLessons(orderedIds);
  revalidatePath("/admin/lessons");
  revalidatePath("/dashboard");
}

// lessonId comes first (not id) so LessonForm can pass a
// deleteDocument.bind(null, lesson.id) reference straight into the client
// SortableFileList — inline arrow functions can't cross the server/client
// boundary as props, only direct server action references (bound or not) can.
export async function deleteDocument(lessonId: string, id: string) {
  await requireAdmin();
  const [doc] = await db.select().from(lessonDocuments).where(eq(lessonDocuments.id, id));
  await db.delete(lessonDocuments).where(eq(lessonDocuments.id, id));
  if (doc) await deleteStorageDir(`private/documents/${doc.filePath}`);
  revalidatePath(`/admin/lessons/${lessonId}`);
}

export async function reorderDocuments(lessonId: string, orderedIds: string[]) {
  await requireAdmin();
  await Promise.all(
    orderedIds.map((id, i) =>
      db.update(lessonDocuments).set({ orderIndex: i }).where(eq(lessonDocuments.id, id))
    )
  );
  revalidatePath(`/admin/lessons/${lessonId}`);
}

export async function deleteAudio(lessonId: string, id: string) {
  await requireAdmin();
  const [track] = await db.select().from(lessonAudio).where(eq(lessonAudio.id, id));
  await db.delete(lessonAudio).where(eq(lessonAudio.id, id));
  if (track) await deleteStorageDir(`private/audio/${track.filePath}`);
  revalidatePath(`/admin/lessons/${lessonId}`);
}

export async function reorderAudio(lessonId: string, orderedIds: string[]) {
  await requireAdmin();
  await Promise.all(
    orderedIds.map((id, i) => db.update(lessonAudio).set({ orderIndex: i }).where(eq(lessonAudio.id, id)))
  );
  revalidatePath(`/admin/lessons/${lessonId}`);
}

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------
export async function setUserAccess(userId: string, hasFullAccess: boolean) {
  await requireAdmin();
  await db
    .update(profiles)
    .set({ hasFullAccess, purchasedAt: hasFullAccess ? new Date() : null })
    .where(eq(profiles.id, userId));
  revalidatePath("/admin/users");
}

// ---------------------------------------------------------------------------
// free access by email — whitelists a Gmail address for free full-course
// access. Applied immediately if that person already has a profile, and
// automatically on first sign-in otherwise (see the jwt callback in
// src/auth.ts).
// ---------------------------------------------------------------------------
export async function addFreeAccessGrant(formData: FormData) {
  const admin = await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!email) return;

  await db
    .insert(freeAccessGrants)
    .values({ email, note, grantedBy: admin.id })
    .onConflictDoUpdate({ target: freeAccessGrants.email, set: { note, grantedBy: admin.id } });

  // Apply immediately if that person already signed up at some point.
  await db
    .update(profiles)
    .set({ hasFullAccess: true, purchasedAt: new Date() })
    .where(eq(profiles.email, email));

  revalidatePath("/admin/users");
}

export async function removeFreeAccessGrant(id: string) {
  await requireAdmin();
  await db.delete(freeAccessGrants).where(eq(freeAccessGrants.id, id));
  revalidatePath("/admin/users");
}
