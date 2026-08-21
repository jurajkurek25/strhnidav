-- Admin-controlled toggle for whether a member appears in /community/members.
alter table profiles add column community_listed boolean not null default true;
