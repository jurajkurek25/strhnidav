"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadToBucket } from "@/lib/media";
import { packageLessonVideoAsEncryptedHls } from "@/lib/hls";
import type { TaskType } from "@/types/database";

// ---------------------------------------------------------------------------
// sections
// ---------------------------------------------------------------------------
export async function createSection(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!title) return;

  const { count } = await admin.from("sections").select("*", { count: "exact", head: true });

  await admin.from("sections").insert({
    title,
    description,
    order_index: count ?? 0,
  });

  revalidatePath("/admin/sections");
}

export async function deleteSection(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("sections").delete().eq("id", id);
  revalidatePath("/admin/sections");
}

// ---------------------------------------------------------------------------
// lessons
// ---------------------------------------------------------------------------
export async function saveLesson(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const lessonId = String(formData.get("lesson_id") ?? "").trim() || null;
  const dayNumber = Number(formData.get("day_number"));
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const sectionId = String(formData.get("section_id") ?? "").trim() || null;
  const taskType = String(formData.get("task_type") ?? "text") as TaskType;
  const taskPrompt = String(formData.get("task_prompt") ?? "").trim() || null;
  const isFree = formData.get("is_free") === "on";

  if (!title || !Number.isFinite(dayNumber)) {
    throw new Error("Deň a názov lekcie sú povinné.");
  }

  const lessonPatch = {
    day_number: dayNumber,
    title,
    description,
    section_id: sectionId,
    task_type: taskType,
    task_prompt: taskPrompt,
    is_free: isFree,
    updated_at: new Date().toISOString(),
  };

  let id = lessonId;
  if (id) {
    const { error } = await admin.from("lessons").update(lessonPatch).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await admin
      .from("lessons")
      .insert(lessonPatch)
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Nepodarilo sa vytvoriť lekciu.");
    id = data.id;
  }

  // Optional new video file replaces the existing one — packaged into
  // AES-128 encrypted HLS (see src/lib/hls.ts) rather than stored raw.
  const video = formData.get("video");
  if (video instanceof File && video.size > 0) {
    const ext = video.name.split(".").pop() || "mp4";
    const buffer = Buffer.from(await video.arrayBuffer());
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
    await packageLessonVideoAsEncryptedHls(id, buffer, ext, siteUrl);
  }

  // Action steps: parallel arrays of (possibly empty) ids and bodies from
  // the dynamic editor. Empty id + non-empty body = new row. Existing id +
  // empty body = delete. Existing id + non-empty body = update in place so
  // we never cascade-delete a user's checklist progress on unrelated edits.
  const ids = formData.getAll("action_step_ids[]").map(String);
  const bodies = formData.getAll("action_steps[]").map(String);
  const { data: existingSteps } = await admin
    .from("action_steps")
    .select("id")
    .eq("lesson_id", id);
  const existingIds = new Set((existingSteps ?? []).map((s) => s.id));
  const keptIds = new Set<string>();

  let orderIndex = 0;
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i].trim();
    const stepId = ids[i];
    if (stepId && existingIds.has(stepId)) {
      if (body) {
        await admin.from("action_steps").update({ body, order_index: orderIndex++ }).eq("id", stepId);
        keptIds.add(stepId);
      }
    } else if (body) {
      await admin.from("action_steps").insert({ lesson_id: id, body, order_index: orderIndex++ });
    }
  }
  const toDelete = [...existingIds].filter((existingId) => !keptIds.has(existingId));
  if (toDelete.length > 0) {
    await admin.from("action_steps").delete().in("id", toDelete);
  }

  // New documents / audio (appended, existing ones are untouched here —
  // removed individually via deleteDocument/deleteAudio).
  const documents = formData.getAll("new_documents").filter((f): f is File => f instanceof File && f.size > 0);
  const { count: docCount } = await admin
    .from("lesson_documents")
    .select("*", { count: "exact", head: true })
    .eq("lesson_id", id);
  for (let i = 0; i < documents.length; i++) {
    const file = documents[i];
    const path = `${id}/${Date.now()}-${file.name}`;
    const result = await uploadToBucket("lesson-documents", path, file, file.type || "application/octet-stream");
    if ("path" in result) {
      await admin.from("lesson_documents").insert({
        lesson_id: id,
        title: file.name,
        file_path: result.path,
        order_index: (docCount ?? 0) + i,
      });
    }
  }

  const audioFiles = formData.getAll("new_audio").filter((f): f is File => f instanceof File && f.size > 0);
  const { count: audioCount } = await admin
    .from("lesson_audio")
    .select("*", { count: "exact", head: true })
    .eq("lesson_id", id);
  for (let i = 0; i < audioFiles.length; i++) {
    const file = audioFiles[i];
    const path = `${id}/${Date.now()}-${file.name}`;
    const result = await uploadToBucket("lesson-audio", path, file, file.type || "audio/mpeg");
    if ("path" in result) {
      await admin.from("lesson_audio").insert({
        lesson_id: id,
        title: file.name,
        file_path: result.path,
        order_index: (audioCount ?? 0) + i,
      });
    }
  }

  revalidatePath("/admin/lessons");
  revalidatePath(`/admin/lessons/${id}`);
  redirect("/admin/lessons");
}

export async function deleteLesson(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("lessons").delete().eq("id", id);
  revalidatePath("/admin/lessons");
}

export async function deleteDocument(id: string, lessonId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("lesson_documents").delete().eq("id", id);
  revalidatePath(`/admin/lessons/${lessonId}`);
}

export async function deleteAudio(id: string, lessonId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("lesson_audio").delete().eq("id", id);
  revalidatePath(`/admin/lessons/${lessonId}`);
}

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------
export async function setUserAccess(userId: string, hasFullAccess: boolean) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({
      has_full_access: hasFullAccess,
      purchased_at: hasFullAccess ? new Date().toISOString() : null,
    })
    .eq("id", userId);
  revalidatePath("/admin/users");
}

// ---------------------------------------------------------------------------
// free access by email — whitelists a Gmail address for free full-course
// access. Applied immediately if that person already has a profile, and
// automatically on first sign-in otherwise (see handle_new_user() in
// supabase/migrations/0004_free_access_grants.sql).
// ---------------------------------------------------------------------------
export async function addFreeAccessGrant(formData: FormData) {
  const admin_ = await requireAdmin();
  const admin = createAdminClient();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!email) return;

  const { error } = await admin
    .from("free_access_grants")
    .upsert({ email, note, granted_by: admin_.id }, { onConflict: "email" });
  if (error) throw new Error(error.message);

  // Apply immediately if that person already signed up at some point.
  await admin
    .from("profiles")
    .update({ has_full_access: true, purchased_at: new Date().toISOString() })
    .eq("email", email);

  revalidatePath("/admin/users");
}

export async function removeFreeAccessGrant(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("free_access_grants").delete().eq("id", id);
  revalidatePath("/admin/users");
}
