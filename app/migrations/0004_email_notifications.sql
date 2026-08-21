-- Tracks every unlock/nudge email actually sent, one row per (user, lesson,
-- kind). The unique constraint is what makes the daily digest cron
-- idempotent: running it twice (or after a restart mid-run) can never
-- double-send the same lesson's unlock email or inactivity nudge.
create table email_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  kind text not null check (kind in ('unlock', 'nudge')),
  sent_at timestamptz not null default now(),
  unique (user_id, lesson_id, kind)
);
