-- Per-block editable price (replacing the flat 99€ constant every section
-- used to share) and an optional friendly slug for direct /buy/[slug]
-- checkout links from external landing pages.
alter table sections add column price_cents integer not null default 9900;
alter table sections add column slug text unique;

create index sections_slug_idx on sections(slug);
