-- Lets the admin whitelist specific email addresses for free full-course
-- access — granted automatically the moment that person signs in with
-- Google (even if they haven't signed up yet), and applied immediately to
-- anyone who already has a profile with that email.

create table free_access_grants (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  note text,
  granted_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table free_access_grants enable row level security;
-- No policies beyond enabling RLS — same pattern as lesson_video_keys: only
-- the service role (admin actions, the signup trigger below) can read/write.

-- Re-declare handle_new_user (originally added in 0001_init.sql) to also
-- check this table on first sign-in.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  is_granted boolean;
begin
  select exists(
    select 1 from public.free_access_grants where lower(email) = lower(new.email)
  ) into is_granted;

  insert into public.profiles (id, email, full_name, avatar_url, is_admin, has_full_access, purchased_at)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.email = 'jurajkurek2006@gmail.com',
    (new.email = 'jurajkurek2006@gmail.com') or is_granted,
    case when is_granted then now() else null end
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url);
  return new;
end;
$$;
