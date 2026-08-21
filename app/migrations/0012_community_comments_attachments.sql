-- Comments on community posts, plus media attachments (any file type,
-- rendered by kind: image/video inline, everything else a download link).
create table community_post_attachments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references community_posts(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime_type text not null,
  kind text not null check (kind in ('image', 'video', 'document')),
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);
create index community_post_attachments_post_idx on community_post_attachments(post_id);

create table community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references community_posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index community_comments_post_idx on community_comments(post_id, created_at);

-- Reports can now also target a comment, not just a post or a user.
alter table community_reports drop constraint community_reports_target_type_check;
alter table community_reports add constraint community_reports_target_type_check
  check (target_type in ('post', 'user', 'comment'));
