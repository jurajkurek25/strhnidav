-- Monthly subscription price, editable alongside the full-course price on
-- /admin/sections instead of being a hardcoded constant.
alter table course_settings add column subscription_price_cents integer not null default 2990;
