-- Gift cards: full-course or single-block access bought as a gift,
-- redeemed by a code. Never issued for a subscription.
create table gift_cards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('course', 'section')),
  section_id uuid references sections(id) on delete cascade,
  amount_cents integer not null,
  currency text not null default 'eur',
  purchased_by_user_id uuid references profiles(id) on delete set null,
  stripe_session_id text unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  redeemed_at timestamptz,
  redeemed_by_user_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Community: profile fields, feed, blocks, reports, DMs.
alter table profiles add column bio text;
alter table profiles add column community_gender text check (community_gender in ('men', 'women'));

create table community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index community_posts_created_idx on community_posts(created_at);

create table community_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);

create table community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'user')),
  target_id uuid not null,
  reason text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table community_conversations (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references profiles(id) on delete cascade,
  user_b_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a_id, user_b_id)
);

create table community_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references community_conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index community_messages_conversation_idx on community_messages(conversation_id, created_at);
