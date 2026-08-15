import "server-only";
import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";

export type TaskType = "text" | "image" | "pdf" | "self_check";
export type SubmissionStatus = "pending" | "approved" | "rejected";
export type PaymentStatus = "pending" | "paid" | "failed";

// One row per signed-in person. Replaces Supabase's auth.users + profiles
// split — google_id is the OAuth identity, id is our own internal PK that
// every other table references.
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  googleId: text("google_id").notNull().unique(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  isAdmin: boolean("is_admin").notNull().default(false),
  hasFullAccess: boolean("has_full_access").notNull().default(false),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sections = pgTable("sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  sectionId: uuid("section_id").references(() => sections.id, { onDelete: "set null" }),
  dayNumber: integer("day_number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  videoDurationSeconds: integer("video_duration_seconds"),
  isFree: boolean("is_free").notNull().default(false),
  taskType: text("task_type").$type<TaskType>().notNull().default("text"),
  taskPrompt: text("task_prompt"),
  orderIndex: integer("order_index").notNull().default(0),
  hlsReady: boolean("hls_ready").notNull().default(false),
  hlsSegmentCount: integer("hls_segment_count"),
  thumbnailReady: boolean("thumbnail_ready").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lessonDocuments = pgTable("lesson_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  filePath: text("file_path").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lessonAudio = pgTable("lesson_audio", {
  id: uuid("id").primaryKey().defaultRandom(),
  lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  filePath: text("file_path").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const actionSteps = pgTable("action_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
});

export const userActionStepCompletions = pgTable(
  "user_action_step_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    actionStepId: uuid("action_step_id").notNull().references(() => actionSteps.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.actionStepId)]
);

// One row per (user, lesson). completedAt is set only once BOTH the video
// has been watched in full AND the task has been approved — this timestamp
// is what the next lesson's unlock is computed from (src/lib/gating.ts).
export const userLessonProgress = pgTable(
  "user_lesson_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
    videoWatchedPercent: numeric("video_watched_percent", { mode: "number" }).notNull().default(0),
    videoCompletedAt: timestamp("video_completed_at", { withTimezone: true }),
    taskCompletedAt: timestamp("task_completed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.lessonId), index("user_lesson_progress_user_idx").on(t.userId)]
);

export const taskSubmissions = pgTable(
  "task_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
    submissionType: text("submission_type").$type<TaskType>().notNull(),
    contentText: text("content_text"),
    filePath: text("file_path"),
    status: text("status").$type<SubmissionStatus>().notNull().default("pending"),
    aiFeedback: text("ai_feedback"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("task_submissions_user_lesson_idx").on(t.userId, t.lessonId)]
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comments_lesson_idx").on(t.lessonId)]
);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  stripeSessionId: text("stripe_session_id").unique(),
  stripePaymentIntent: text("stripe_payment_intent"),
  amountCents: integer("amount_cents").notNull().default(19900),
  currency: text("currency").notNull().default("eur"),
  status: text("status").$type<PaymentStatus>().notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Set only if the user checked the "okamžité sprístupnenie" consent box
  // before starting checkout — see čl. 7 Obchodných podmienok. Evidence
  // that the digital-content withdrawal-right exception was invoked.
  withdrawalConsentAt: timestamp("withdrawal_consent_at", { withTimezone: true }),
});

// Deliberately never read from client code or exposed in any API response
// beyond /api/video-key/[lessonId] (after its own auth + gating check) —
// see src/app/api/video-key/[lessonId]/route.ts.
export const lessonVideoKeys = pgTable("lesson_video_keys", {
  lessonId: uuid("lesson_id").primaryKey().references(() => lessons.id, { onDelete: "cascade" }),
  keyId: text("key_id").notNull(),
  aesKeyBase64: text("aes_key_base64").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per person who has finished every lesson of the paid course.
// Issued once (id is the public verification code embedded in the
// certificate's QR code / kurz.strhnidav.sk/certifikat/[id]) and never
// re-generated — fullName is a snapshot at issuance time so a later Google
// profile-name change can't retroactively alter an already-issued document.
export const certificates = pgTable("certificates", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => profiles.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
});

// Whitelists a Gmail address for free full-course access — applied
// immediately if that person already has a profile, and automatically on
// first sign-in otherwise (see the signIn callback in src/auth.ts).
export const freeAccessGrants = pgTable("free_access_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  note: text("note"),
  grantedBy: uuid("granted_by").references(() => profiles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
