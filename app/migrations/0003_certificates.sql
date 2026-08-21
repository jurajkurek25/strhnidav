-- Certificates of completion. id is the public verification code (embedded
-- in the QR code and the printable /certifikat/[id] link) — a bare random
-- uuid, unguessable, so it doubles as an authenticity token with no extra
-- column needed.
create table certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  full_name text not null,
  issued_at timestamptz not null default now()
);
