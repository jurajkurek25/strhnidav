-- Bug found via local testing: comments embed profiles(full_name, avatar_url)
-- to show the author's name, but profiles' only SELECT policy is "own row
-- only" (profiles_select_own) — and PostgREST resource embedding enforces
-- RLS on the embedded table too. In practice every OTHER member's comment
-- was silently rendering the "Člen" fallback instead of their real name.
--
-- Fix: a plain (non security-invoker) view exposing just the two fields
-- that are fine to show across the whole membership — id, full_name,
-- avatar_url. Since the view is owned by the same role that owns
-- `profiles` (and doesn't set security_invoker), Postgres evaluates it
-- with the *view owner's* privileges, which bypasses profiles' RLS the
-- same way the table owner already does — so this exposes exactly the two
-- public columns for every row, and nothing else (email, has_full_access,
-- is_admin, purchased_at stay behind profiles_select_own).
create view public_member_profiles as
  select id, full_name, avatar_url from profiles;

grant select on public_member_profiles to authenticated;
