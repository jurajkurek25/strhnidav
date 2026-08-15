-- Auto-generated thumbnail (a single frame grabbed by ffmpeg when the
-- lesson's video is packaged — see src/lib/hls.ts) shown on the dashboard
-- and admin lesson grids instead of a plain placeholder.
alter table lessons add column if not exists thumbnail_ready boolean not null default false;

insert into storage.buckets (id, name, public)
values ('lesson-thumbnails', 'lesson-thumbnails', true)
on conflict (id) do nothing;
