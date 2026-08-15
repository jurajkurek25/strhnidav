-- Self-hosted "soft DRM": lessons are packaged into AES-128 encrypted HLS
-- (segmented .ts files + .m3u8 playlist) instead of a single MP4. The
-- encrypted segments themselves are safe to serve publicly — without the
-- key they're useless — so only the decryption key is access-controlled.

alter table lessons add column if not exists hls_ready boolean not null default false;
alter table lessons add column if not exists hls_segment_count int;

-- Deliberately has ZERO row level security policies beyond enabling RLS —
-- this means no role except service_role (which bypasses RLS entirely) can
-- read or write it. Only src/app/api/video-key/[lessonId]/route.ts (using
-- the admin/service-role client, after its own auth + gating check) may
-- ever read a raw key. Never add a select policy here.
create table lesson_video_keys (
  lesson_id uuid primary key references lessons(id) on delete cascade,
  key_id text not null,
  aes_key_base64 text not null,
  created_at timestamptz not null default now()
);
alter table lesson_video_keys enable row level security;

insert into storage.buckets (id, name, public)
values ('lesson-videos-hls', 'lesson-videos-hls', true)
on conflict (id) do nothing;
