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
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

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

// Single-row table (id is always true) holding the full-course price and
// the monthly subscription price — both admin-editable from
// /admin/sections, read by the checkout route instead of hardcoded
// constants. The two are intentionally independent (not derived from one
// another): the one-time price is what a lifetime-access buyer pays
// regardless of course length, while the subscription's *effective* total
// cost already grows on its own as more content is added, since lessons
// unlock one per day and can't be rushed through. Existing `payments` /
// `subscriptions` rows keep the amount actually paid at the time (see
// amountCents on those tables), unaffected by later edits here.
export const courseSettings = pgTable("course_settings", {
  id: boolean("id").primaryKey().default(true),
  priceCents: integer("price_cents").notNull().default(29900),
  subscriptionPriceCents: integer("subscription_price_cents").notNull().default(2990),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sections = pgTable(
  "sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    orderIndex: integer("order_index").notNull().default(0),
    // Per-block price for individual (section) purchases — admin-editable,
    // read directly by the checkout route instead of a shared constant, so
    // each block can be priced on its own. Existing sectionPurchases rows
    // keep the amount actually paid at the time, unaffected by later edits
    // here (see amountCents on that table).
    priceCents: integer("price_cents").notNull().default(9900),
    // Optional friendly URL for external landing pages to link straight
    // into a checkout for this one block — /buy/[slug]. Null means no
    // direct link has been set up for this block yet.
    slug: text("slug").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sections_slug_idx").on(t.slug)]
);

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

// One row per attempted purchase of a single section ("block") — the
// per-block alternative to a full-course `payments` row. Access to a
// section's paywalled lessons is granted once a row here reaches
// status "paid" (see computeLessonStates in src/lib/gating.ts).
export const sectionPurchases = pgTable(
  "section_purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id").notNull().references(() => sections.id, { onDelete: "cascade" }),
    stripeSessionId: text("stripe_session_id").unique(),
    stripePaymentIntent: text("stripe_payment_intent"),
    amountCents: integer("amount_cents").notNull().default(9900),
    currency: text("currency").notNull().default("eur"),
    status: text("status").$type<PaymentStatus>().notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("section_purchases_user_idx").on(t.userId)]
);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  stripeSessionId: text("stripe_session_id").unique(),
  stripePaymentIntent: text("stripe_payment_intent"),
  amountCents: integer("amount_cents").notNull().default(29900),
  currency: text("currency").notNull().default("eur"),
  status: text("status").$type<PaymentStatus>().notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Set only if the user checked the "okamžité sprístupnenie" consent box
  // before starting checkout — see čl. 7 Obchodných podmienok. Evidence
  // that the digital-content withdrawal-right exception was invoked.
  withdrawalConsentAt: timestamp("withdrawal_consent_at", { withTimezone: true }),
});

// One row per Stripe subscription a person has ever had — the recurring
// 29,90 €/month alternative to a one-time `payments` row. Full access
// (profiles.hasFullAccess) is kept in sync with whichever row here is
// currently "active"/"trialing" by the webhook (see
// src/app/api/stripe/webhook/route.ts) — this table is the source of
// truth that sync is computed from, so it's never blown away just because
// a subscription lapses.
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
    status: text("status").$type<SubscriptionStatus>().notNull(),
    amountCents: integer("amount_cents").notNull().default(2990),
    currency: text("currency").notNull().default("eur"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("subscriptions_user_idx").on(t.userId)]
);

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

export type EmailNotificationKind = "unlock" | "nudge";

// One row per email actually sent for a given (user, lesson, kind) — the
// unique constraint is what makes the daily digest cron idempotent: running
// it twice, or restarting mid-run, can never double-send the same lesson's
// unlock email or nudge to the same person.
export const emailNotifications = pgTable(
  "email_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
    kind: text("kind").$type<EmailNotificationKind>().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.userId, table.lessonId, table.kind)]
);

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
