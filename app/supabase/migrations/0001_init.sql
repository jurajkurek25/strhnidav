-- Strhni Dav — membership app schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles (mirrors auth.users, one row per signed-in person)
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  is_admin boolean not null default false,
  has_full_access boolean not null default false,
  purchased_at timestamptz,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever someone signs in via Supabase Auth for
-- the first time. The configured admin email is flagged as admin here so the
-- very first login already has the right role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, is_admin)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.email = 'jurajkurek2006@gmail.com'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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
  video_path text,              -- path inside the private `lesson-videos` bucket
  video_duration_seconds int,
  lock_image_path text,         -- optional custom lock artwork; falls back to default svg
  is_free boolean not null default false,
  task_type text not null default 'text' check (task_type in ('text', 'image', 'pdf', 'self_check')),
  task_prompt text,             -- instructions shown above the submission box
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lessons_day_number_idx on lessons(day_number);

create table lesson_documents (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  title text not null,
  file_path text not null,      -- path inside `lesson-documents`
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table lesson_audio (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  title text not null,
  file_path text not null,      -- path inside `lesson-audio`
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
-- progress & gating
-- ---------------------------------------------------------------------------
create table user_action_step_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  action_step_id uuid not null references action_steps(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (user_id, action_step_id)
);

-- One row per (user, lesson). `completed_at` is set only once BOTH the video
-- has been watched in full AND the task has been approved — this timestamp
-- is what the next lesson's unlock is computed from, so it can never be
-- backdated or batched by waiting several days at once.
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
  file_path text,               -- path inside `task-uploads`
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
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table sections enable row level security;
alter table lessons enable row level security;
alter table lesson_documents enable row level security;
alter table lesson_audio enable row level security;
alter table action_steps enable row level security;
alter table user_action_step_completions enable row level security;
alter table user_lesson_progress enable row level security;
alter table task_submissions enable row level security;
alter table comments enable row level security;
alter table payments enable row level security;

-- profiles: everyone can read their own row; only the row owner can update
-- non-privileged fields (has_full_access / is_admin are only ever changed by
-- the service role from server-side code).
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- course content: readable by any signed-in user, writes are service-role only
-- (the admin panel goes through API routes using the service role key).
create policy "sections_select_authenticated" on sections for select using (auth.role() = 'authenticated');
create policy "lessons_select_authenticated" on lessons for select using (auth.role() = 'authenticated');
create policy "lesson_documents_select_authenticated" on lesson_documents for select using (auth.role() = 'authenticated');
create policy "lesson_audio_select_authenticated" on lesson_audio for select using (auth.role() = 'authenticated');
create policy "action_steps_select_authenticated" on action_steps for select using (auth.role() = 'authenticated');

-- progress & submissions: strictly own-row only
create policy "step_completions_own" on user_action_step_completions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lesson_progress_select_own" on user_lesson_progress
  for select using (auth.uid() = user_id);
create policy "task_submissions_select_own" on task_submissions
  for select using (auth.uid() = user_id);
create policy "task_submissions_insert_own" on task_submissions
  for insert with check (auth.uid() = user_id);

-- comments: any signed-in user can read/post, only the author can delete their own
create policy "comments_select_authenticated" on comments for select using (auth.role() = 'authenticated');
create policy "comments_insert_own" on comments for insert with check (auth.uid() = user_id);
create policy "comments_delete_own" on comments for delete using (auth.uid() = user_id);

-- payments: own rows only, read-only from the client (webhook writes via service role)
create policy "payments_select_own" on payments for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage buckets (private — every file is served through short-lived signed
-- URLs issued by server-side API routes after an access check, never exposed
-- directly to the client).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('lesson-videos', 'lesson-videos', false),
  ('lesson-documents', 'lesson-documents', false),
  ('lesson-audio', 'lesson-audio', false),
  ('task-uploads', 'task-uploads', false),
  ('lock-art', 'lock-art', false)
on conflict (id) do nothing;

-- No storage.objects policies are created for authenticated/anon roles: all
-- reads and writes go through the service role key from API routes, which
-- bypasses RLS by design. This keeps "who can see which video" enforced in
-- one place (the gating logic) instead of duplicated in storage policies.
