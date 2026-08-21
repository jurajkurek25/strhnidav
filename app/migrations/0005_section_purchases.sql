-- Per-block ("section") purchases — the 99€ alternative to the 199€
-- full-course row in `payments`. A user has paid access to a section's
-- paywalled lessons once a row here for that (user, section) has
-- status = 'paid'.
create table section_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  section_id uuid not null references sections(id) on delete cascade,
  stripe_session_id text unique,
  stripe_payment_intent text,
  amount_cents integer not null default 9900,
  currency text not null default 'eur',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  created_at timestamptz not null default now()
);

create index section_purchases_user_idx on section_purchases(user_id);
