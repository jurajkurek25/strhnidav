-- Gender-specific lesson tracks. A Lesson's audience determines whose
-- day-by-day sequence it belongs to; a member's audience_preference picks
-- which track unlocks day-by-day for them (the other becomes freely
-- watchable — see src/lib/gating.ts).
alter table lessons add column audience text not null default 'all'
  check (audience in ('all', 'men', 'women'));

alter table profiles add column audience_preference text
  check (audience_preference in ('men', 'women', 'both'));
