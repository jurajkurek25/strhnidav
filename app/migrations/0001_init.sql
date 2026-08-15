-- Strhni Dav — membership app schema (self-hosted, plain Postgres).
-- Run once against a fresh database: psql "$DATABASE_URL" -f migrations/0001_init.sql
--
-- No Supabase, no Row Level Security, no storage buckets — access control
-- lives entirely in the app layer (src/lib/auth.ts, src/lib/course.ts), the
-- same way every other query already had to filter by user_id explicitly.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles (one row per signed-in person; google_id is the OAuth identity)
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key default gen_random_uuid(),
  google_id text not null unique,
  email text not null unique,
  full_name text,
  avatar_url text,
  is_admin boolean not null default false,
  has_full_access boolean not null default false,
  purchased_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- course structure
-- ---------------------------------------------------------------------------
create table sections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references sections(id) on delete set null,
  day_number int not null unique,
  title text not null,
  description text,
  video_duration_seconds int,
  is_free boolean not null default false,
  task_type text not null default 'text' check (task_type in ('text', 'image', 'pdf', 'self_check')),
  task_prompt text,
  order_index int not null default 0,
  hls_ready boolean not null default false,
  hls_segment_count int,
  thumbnail_ready boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lessons_day_number_idx on lessons(day_number);

create table lesson_documents (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  title text not null,
  file_path text not null,      -- relative path under STORAGE_ROOT/documents
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table lesson_audio (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  title text not null,
  file_path text not null,      -- relative path under STORAGE_ROOT/audio
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table action_steps (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  body text not null,
  order_index int not null default 0
);

-- ---------------------------------------------------------------------------
-- video protection — self-hosted AES-128 encrypted HLS. Segments/playlist
-- are public static files (useless without the key); the key itself lives
-- only here and is served only by /api/video-key/[lessonId] after an
-- explicit auth + gating check in application code.
-- ---------------------------------------------------------------------------
create table lesson_video_keys (
  lesson_id uuid primary key references lessons(id) on delete cascade,
  key_id text not null,
  aes_key_base64 text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- progress & gating
-- ---------------------------------------------------------------------------
create table user_action_step_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  action_step_id uuid not null references action_steps(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (user_id, action_step_id)
);

-- One row per (user, lesson). completed_at is set only once BOTH the video
-- has been watched in full AND the task has been approved — this timestamp
-- is what the next lesson's unlock is computed from, so it can never be
-- backdated or batched by waiting several days at once (src/lib/gating.ts).
create table user_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  video_watched_percent numeric not null default 0,
  video_completed_at timestamptz,
  task_completed_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);
create index user_lesson_progress_user_idx on user_lesson_progress(user_id);

create table task_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  submission_type text not null check (submission_type in ('text', 'image', 'pdf', 'self_check')),
  content_text text,
  file_path text,               -- relative path under STORAGE_ROOT/task-uploads
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  ai_feedback text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index task_submissions_user_lesson_idx on task_submissions(user_id, lesson_id);

-- ---------------------------------------------------------------------------
-- discussion
-- ---------------------------------------------------------------------------
create table comments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  parent_id uuid references comments(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index comments_lesson_idx on comments(lesson_id);

-- ---------------------------------------------------------------------------
-- payments (Stripe)
-- ---------------------------------------------------------------------------
create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  stripe_session_id text unique,
  stripe_payment_intent text,
  amount_cents int not null default 19900,
  currency text not null default 'eur',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- free access by email — whitelists a Gmail address for free full-course
-- access, applied immediately if that person already has a profile, and
-- automatically on first sign-in otherwise (see the signIn callback in
-- src/auth.ts, which replaces the old Postgres trigger).
-- ---------------------------------------------------------------------------
create table free_access_grants (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  note text,
  granted_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
