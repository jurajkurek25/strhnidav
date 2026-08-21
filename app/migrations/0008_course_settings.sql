-- Singleton table holding the full-course price, so it can be edited from
-- the admin panel instead of living as a hardcoded constant in code.
create table course_settings (
  id boolean primary key default true check (id),
  price_cents integer not null default 29900,
  updated_at timestamptz not null default now()
);

insert into course_settings (id, price_cents) values (true, 29900);
