-- Recurring 29,90 €/month subscription — the alternative to a one-time
-- `payments` row. Full access (profiles.has_full_access) is kept in sync
-- with whichever row here is "active"/"trialing" by the Stripe webhook;
-- this table is the source of truth that sync is recomputed from, so a
-- lapsed subscription never wipes out access someone got another way
-- (one-time purchase, free grant, admin toggle).
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  status text not null check (status in (
    'active', 'trialing', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused'
  )),
  amount_cents integer not null default 2990,
  currency text not null default 'eur',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_user_idx on subscriptions(user_id);
